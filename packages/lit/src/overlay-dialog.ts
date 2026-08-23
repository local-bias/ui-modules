import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import type { DialogController } from './controller';
import type {
  DialogState,
  FormFieldGroup,
  FormFieldMeta,
  FormLayout,
  QueueItem,
  StepItem,
} from './types';
import { createInitialState } from './types';
import { overlayStyles } from './styles';
import { parseDateInputValue, toDateInputValue } from './form-date-utils';
import { trapTabFocus } from './focus-trap';
import { renderAlertIcon, renderSpinner, renderTaskIcon } from './icons';
import { nextStepIndex, prevStepIndex } from './step-utils';

// ─── Form rendering context ───────────────────────────────────
// Abstracts data access so form rendering methods stay independent
// of where the values live.

interface FormContext {
  getValue: (key: string) => unknown;
  getError: (key: string) => string;
  getTouched: (key: string) => boolean;
  onUpdate: (key: string, value: unknown) => void;
  onBlur: (key: string) => void;
}

export class OverlayDialog extends LitElement {
  static override styles = overlayStyles;

  @property({ attribute: false })
  controller!: DialogController;

  @state() private _state: DialogState = createInitialState();
  @state() private _bodyKey = 0;
  @state() private _isClosing = false;

  /** Snapshot of the most recent *open* state, rendered during the close-fade. */
  private _lastOpenState: DialogState = createInitialState();

  private _unsubscribe?: () => void;
  private _closeTimer?: ReturnType<typeof setTimeout>;
  private _beforeUnloadHandler = (e: BeforeUnloadEvent) => e.preventDefault();
  /** Body's overflow value prior to locking, restored when the dialog closes. */
  private _prevBodyOverflow: string | null = null;
  private _unloadGuardActive = false;
  /** Watches the scroll region so its keyboard affordance follows the content size. */
  private _bodyResizeObserver?: ResizeObserver;
  /** Element focused before the dialog opened; focus returns here on close. */
  private _previouslyFocused: HTMLElement | null = null;
  private _pendingFocus = false;

  /**
   * Only block page navigation for dialogs representing in-flight work.
   *
   * steps クロームの有無は見ない — 処理中はクロームの下に loading/queue 本文が
   * 出ているので既に該当するし、入力待ちの form/step-form 本文まで巻き込むのは
   * 「in-flight work だけ」という本来の意図から外れる。
   */
  private _isBusyDialog(s: DialogState): boolean {
    return (
      s.open &&
      (s.dialogType === 'loading' || s.dialogType === 'queue' || s.progress !== null)
    );
  }

  private _syncUnloadGuard(s: DialogState): void {
    const shouldGuard = this._isBusyDialog(s);
    if (shouldGuard === this._unloadGuardActive) return;
    this._unloadGuardActive = shouldGuard;
    if (shouldGuard) {
      window.addEventListener('beforeunload', this._beforeUnloadHandler);
    } else {
      window.removeEventListener('beforeunload', this._beforeUnloadHandler);
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.controller) {
      this._state = { ...this.controller.state };
      if (this._state.open) {
        this._lastOpenState = this._state;
        this._previouslyFocused = (document.activeElement as HTMLElement) ?? null;
        this._pendingFocus = true;
      }
      this._syncUnloadGuard(this._state);
      this._unsubscribe = this.controller.subscribe((s) => {
        const wasOpen = this._state.open;
        const prevDialogType = this._state.dialogType;
        const prevIndex = this._state.stepIndex;

        if (s.open && !wasOpen) {
          this._isClosing = false;
          clearTimeout(this._closeTimer);
          this._previouslyFocused = (document.activeElement as HTMLElement) ?? null;
          this._pendingFocus = true;
        } else if (!s.open && wasOpen) {
          this._isClosing = true;
          clearTimeout(this._closeTimer);
          this._closeTimer = setTimeout(() => {
            this._isClosing = false;
          }, 320);
          this._restoreFocus();
        }
        this._syncUnloadGuard(s);

        if (s.open && s.dialogType !== prevDialogType) {
          this._bodyKey++;
          // keyed() below discards the old body-inner subtree (and whatever had focus in
          // it), so reclaim focus on .card to keep the Escape/Tab-trap handler reachable.
          this._pendingFocus = true;
        } else if (s.open && s.dialogType === 'step-form' && s.stepIndex !== prevIndex) {
          // re-animate the body when navigating between wizard steps. The steps chrome
          // sits outside keyed() so it transitions in place instead of re-entering.
          this._bodyKey++;
          this._pendingFocus = true;
        }

        if (s.open) this._lastOpenState = s;
        this._state = s;
        this._syncBodyScroll(s.open);
      });
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubscribe?.();
    this._syncBodyScroll(false);
    this._bodyResizeObserver?.disconnect();
    this._bodyResizeObserver = undefined;
    clearTimeout(this._closeTimer);
    window.removeEventListener('beforeunload', this._beforeUnloadHandler);
    this._unloadGuardActive = false;
  }

  override updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);
    this._observeBodyScroll();
    if (this._pendingFocus) {
      this._pendingFocus = false;
      this._focusCard();
    }
  }

  // ─── Scrollable body ─────────────────────────────────────

  /**
   * 本文がカードに収まらないときだけ `.card-body` をフォーカス可能にする。
   * スクロール領域は自分がフォーカスを取れないとキーボードで動かせないが、
   * 常時 tabindex を置くと短いダイアログに無意味なタブ停止が増えるため。
   */
  private _syncBodyScrollability(): void {
    const body = (this.renderRoot as ShadowRoot).querySelector<HTMLElement>('.card-body');
    if (!body) return;

    if (body.scrollHeight > body.clientHeight) {
      body.setAttribute('tabindex', '0');
      body.setAttribute('data-scrollable', '');
    } else {
      body.removeAttribute('tabindex');
      body.removeAttribute('data-scrollable');
    }
  }

  /** 描画後だけでなく、画像や非同期 HTML で中身が伸びたときも追随させる。 */
  private _observeBodyScroll(): void {
    const body = (this.renderRoot as ShadowRoot).querySelector<HTMLElement>('.card-body');
    if (!body) return;

    if (!this._bodyResizeObserver && typeof ResizeObserver !== 'undefined') {
      this._bodyResizeObserver = new ResizeObserver(() => this._syncBodyScrollability());
    }
    const observer = this._bodyResizeObserver;
    if (observer) {
      observer.disconnect();
      observer.observe(body);
      // keyed() で差し替わる本文ラッパー。カード側の高さが変わらないまま
      // 中身だけ伸びるケースはこちらでしか拾えない。
      const inner = body.firstElementChild;
      if (inner) observer.observe(inner);
    }

    this._syncBodyScrollability();
  }

  private _syncBodyScroll(lock: boolean): void {
    if (lock) {
      if (this._prevBodyOverflow === null) {
        this._prevBodyOverflow = document.body.style.overflow;
      }
      document.body.style.overflow = 'hidden';
    } else if (this._prevBodyOverflow !== null) {
      document.body.style.overflow = this._prevBodyOverflow;
      this._prevBodyOverflow = null;
    }
  }

  // ─── Focus management ────────────────────────────────────

  private _focusCard(): void {
    const card = (this.renderRoot as ShadowRoot).querySelector<HTMLElement>('.card');
    card?.focus();
  }

  private _restoreFocus(): void {
    const el = this._previouslyFocused;
    this._previouslyFocused = null;
    if (el && el.isConnected && typeof el.focus === 'function') {
      el.focus();
    }
  }

  private _trapFocus(e: KeyboardEvent): void {
    const root = this.renderRoot as ShadowRoot;
    const card = root.querySelector('.card');
    if (!card) return;
    trapTabFocus(e, card, root.activeElement, () => this._focusCard());
  }

  // ─── Event Handlers ──────────────────────────────────────

  private _onBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      this.controller.onOutsideClick();
    }
  }

  private _onCardKeyDown = (e: KeyboardEvent): void => {
    if (!this._state.open) return;
    if (e.key === 'Escape') {
      this.controller.onEscapeKey();
      return;
    }
    if (e.key === 'Tab') {
      this._trapFocus(e);
    }
  };

  // ─── Render Helpers ──────────────────────────────────────

  private _getQueueWindow(items: QueueItem[]): { start: number; end: number } {
    const total = items.length;
    if (total <= 4) return { start: 0, end: total - 1 };

    // active なら中心に。なければ最後の完了済み+1 (次の pending) を中心とする。
    let centerIdx = items.findIndex((i) => i.status === 'active');
    if (centerIdx < 0) {
      const finishedStatuses = new Set<QueueItem['status']>(['done', 'skipped', 'error']);
      const lastFinishedIdx = items.reduce(
        (acc, item, i) => (finishedStatuses.has(item.status) ? i : acc),
        -1
      );
      centerIdx = lastFinishedIdx >= 0 ? Math.min(lastFinishedIdx + 1, total - 1) : 0;
    }

    // まず WINDOW=3 で両側に点々が出るかを判定する
    const s3 = Math.max(0, Math.min(centerIdx - 1, total - 3));
    const e3 = Math.min(total - 1, s3 + 2);
    const hasTop = s3 > 0;
    const hasBottom = e3 < total - 1;

    if (hasTop && hasBottom) {
      // 中間: 点々 + 3項目 + 点々 = 5行
      return { start: s3, end: e3 };
    }
    // 先頭または末尾: 点々なし側を4項目に拡張して常に 4項目 + 点々 = 5行
    if (!hasTop) {
      return { start: 0, end: 3 };
    }
    return { start: total - 4, end: total - 1 };
  }

  private _renderQueueList(items: QueueItem[]): TemplateResult {
    const total = items.length;
    const { start, end } = this._getQueueWindow(items);
    const visible = items.slice(start, end + 1);

    const finishedStatuses = new Set<QueueItem['status']>(['done', 'skipped', 'error']);
    const doneCount = items.filter((i) => finishedStatuses.has(i.status)).length;
    const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    const topHidden = start;
    const bottomHidden = total - 1 - end;

    return html`
      <div class="queue-layout">
        <div class="queue-progress-v">
          <div class="queue-progress-track-v">
            <div class="queue-progress-fill-v" style="height: ${pct}%"></div>
          </div>
          <span class="queue-progress-count-v">${doneCount}/${total}</span>
        </div>
        <ul class="task-list">
          ${topHidden > 0
            ? html`<li class="queue-ellipsis" aria-hidden="true">
                <div class="queue-ellipsis-dots"><span></span><span></span><span></span></div>
                <span class="queue-ellipsis-badge">+${topHidden}</span>
              </li>`
            : nothing}
          ${repeat(
            visible,
            (item) => item.key,
            (item) => html`
              <li class="task-item" data-status=${item.status}>
                <span class="task-icon">${renderTaskIcon(item.status)}</span>
                <span class="task-label" data-status=${item.status}>${item.label}</span>
              </li>
            `
          )}
          ${bottomHidden > 0
            ? html`<li class="queue-ellipsis" aria-hidden="true">
                <div class="queue-ellipsis-dots"><span></span><span></span><span></span></div>
                <span class="queue-ellipsis-badge">+${bottomHidden}</span>
              </li>`
            : nothing}
        </ul>
      </div>
    `;
  }

  /**
   * ステップインジケータ。`card-body` の外 — つまり `keyed()` の外 — に描画され、
   * 本文がどう差し替わっても DOM が維持されるので、ドットとラベルは作り直されずに
   * CSS トランジションで状態だけが変化する。
   *
   * 実体は順序付きリスト。ドットは装飾なので aria-hidden にし、読み上げは
   * 各ステップのラベル + 現在位置を示す aria-current が担う。ステップ間を
   * つなぐ線は `.step-item::before` (CSS) — 等幅カラムの中心同士を結ぶ。
   */
  private _renderStepsChrome(s: DialogState): TemplateResult | typeof nothing {
    if (!s.steps.length) return nothing;

    const current: StepItem | undefined = s.steps[s.stepIndex];

    return html`
      <div class="steps-chrome">
        <ol class="steps-header">
          ${s.steps.map(
            (item, i) => html`
              <li
                class="step-item"
                data-status=${item.status}
                aria-current=${i === s.stepIndex ? 'step' : nothing}
              >
                <span class="step-dot" data-status=${item.status} aria-hidden="true"></span>
                <span
                  class="step-label"
                  id=${i === s.stepIndex ? 'dialog-step-label' : nothing}
                  >${item.label}</span
                >
              </li>
            `
          )}
        </ol>
        ${current
          ? html`<p class="steps-counter">${s.stepIndex + 1} / ${s.steps.length}</p>`
          : nothing}
      </div>
    `;
  }

  // ─── Form Helpers ────────────────────────────────────────

  /**
   * 単発フォームでもウィザードでも同じコンテキストで足りる — コントローラーが
   * ウィザードの現在ステップを `state.form*` に射影しているため。
   */
  private _createFormContext(s: DialogState): FormContext {
    return {
      getValue: (k) => s.formValues[k],
      getError: (k) => s.formErrors[k] ?? '',
      getTouched: (k) => !!s.formTouched[k],
      onUpdate: (k, v) => this.controller.updateFormField(k, v),
      onBlur: (k) => this.controller.touchFormField(k),
    };
  }

  private _getOrderedFields(fields: FormFieldMeta[], layout: FormLayout): FormFieldMeta[] {
    const order = layout.fieldOrder;
    if (!order?.length) return fields;

    const fieldMap = new Map(fields.map((f) => [f.key, f]));
    const ordered: FormFieldMeta[] = [];
    for (const key of order) {
      const f = fieldMap.get(key);
      if (f) {
        ordered.push(f);
        fieldMap.delete(key);
      }
    }
    for (const f of fieldMap.values()) {
      ordered.push(f);
    }
    return ordered;
  }

  private _renderFormGrid(
    fields: FormFieldMeta[],
    columns: number,
    gap: string,
    ctx: FormContext
  ): TemplateResult {
    return html`
      <div class="form-grid" style="--dialog-form-columns:${columns}; gap:${gap}">
        ${fields.map((f) => this._renderFormField(f, ctx))}
      </div>
    `;
  }

  private _renderGroupedForm(
    allFields: FormFieldMeta[],
    groups: FormFieldGroup[],
    layout: FormLayout,
    ctx: FormContext
  ): TemplateResult {
    const fieldMap = new Map(allFields.map((f) => [f.key, f]));
    const usedKeys = new Set<string>();
    const gap = layout.gap ?? '16px';

    const groupFragments = groups.map((group) => {
      const groupFields: FormFieldMeta[] = [];
      for (const key of group.fields) {
        const f = fieldMap.get(key);
        if (f) {
          groupFields.push(f);
          usedKeys.add(key);
        }
      }
      if (!groupFields.length) return nothing;

      const cols = group.columns ?? layout.columns ?? 1;
      return html`
        <fieldset class="form-group">
          ${group.label ? html`<legend class="form-group-label">${group.label}</legend>` : nothing}
          ${this._renderFormGrid(groupFields, cols, gap, ctx)}
        </fieldset>
      `;
    });

    const remaining = allFields.filter((f) => !usedKeys.has(f.key));
    return html`
      ${groupFragments}
      ${remaining.length ? this._renderFormGrid(remaining, layout.columns ?? 1, gap, ctx) : nothing}
    `;
  }

  private _renderForm(
    fields: FormFieldMeta[],
    layout: FormLayout,
    ctx: FormContext
  ): TemplateResult {
    const ordered = this._getOrderedFields(fields, layout);
    const gap = layout.gap ?? '16px';

    if (layout.groups?.length) {
      return this._renderGroupedForm(ordered, layout.groups, layout, ctx);
    }

    return this._renderFormGrid(ordered, layout.columns ?? 1, gap, ctx);
  }

  private _renderFormField(field: FormFieldMeta, ctx: FormContext): TemplateResult {
    const value = ctx.getValue(field.key);
    const error = ctx.getError(field.key);
    const touched = ctx.getTouched(field.key);
    const showError = touched && !!error;

    if (field.inputType === 'checkbox') {
      return html`
        <div class="form-field" data-type="checkbox" ?data-error=${showError}>
          <label class="form-checkbox-label">
            <input
              type="checkbox"
              class="form-checkbox"
              .checked=${!!value}
              @change=${(e: Event) =>
                ctx.onUpdate(field.key, (e.target as HTMLInputElement).checked)}
              @blur=${() => ctx.onBlur(field.key)}
            />
            <span class="form-checkbox-text">
              ${field.label}
              ${field.required ? html`<span class="form-required">*</span>` : nothing}
            </span>
          </label>
          ${showError ? html`<span class="form-error">${error}</span>` : nothing}
        </div>
      `;
    }

    return html`
      <div class="form-field" data-type=${field.inputType} ?data-error=${showError}>
        <label class="form-label" for="form-${field.key}">
          ${field.label} ${field.required ? html`<span class="form-required">*</span>` : nothing}
        </label>
        ${field.description ? html`<span class="form-hint">${field.description}</span>` : nothing}
        ${this._renderFormInput(field, value, ctx)}
        ${showError ? html`<span class="form-error">${error}</span>` : nothing}
      </div>
    `;
  }

  private _renderFormInput(field: FormFieldMeta, value: unknown, ctx: FormContext): TemplateResult {
    switch (field.inputType) {
      case 'select':
        return html`
          <select
            class="form-select"
            id="form-${field.key}"
            @change=${(e: Event) => {
              const v = (e.target as HTMLSelectElement).value;
              ctx.onUpdate(field.key, v === '' ? undefined : v);
            }}
            @blur=${() => ctx.onBlur(field.key)}
          >
            <option value="" ?selected=${!value}>${this.controller.texts.selectPlaceholder}</option>
            ${field.options.map(
              (opt) => html`<option value=${opt} ?selected=${value === opt}>${opt}</option>`
            )}
          </select>
        `;

      case 'number':
        return html`
          <input
            type="number"
            class="form-input"
            id="form-${field.key}"
            .value=${value != null ? String(value) : ''}
            min=${field.min ?? nothing}
            max=${field.max ?? nothing}
            placeholder=${field.placeholder || nothing}
            @input=${(e: Event) => {
              const v = (e.target as HTMLInputElement).valueAsNumber;
              ctx.onUpdate(field.key, Number.isNaN(v) ? undefined : v);
            }}
            @blur=${() => ctx.onBlur(field.key)}
          />
        `;

      case 'date':
        return html`
          <input
            type="date"
            class="form-input"
            id="form-${field.key}"
            .value=${toDateInputValue(value)}
            @input=${(e: Event) => {
              const str = (e.target as HTMLInputElement).value;
              ctx.onUpdate(field.key, parseDateInputValue(str));
            }}
            @blur=${() => ctx.onBlur(field.key)}
          />
        `;

      default:
        return html`
          <input
            type=${field.inputType}
            class="form-input"
            id="form-${field.key}"
            .value=${(value as string) ?? ''}
            minlength=${field.minLength ?? nothing}
            maxlength=${field.maxLength ?? nothing}
            placeholder=${field.placeholder || nothing}
            @input=${(e: Event) => ctx.onUpdate(field.key, (e.target as HTMLInputElement).value)}
            @blur=${() => ctx.onBlur(field.key)}
          />
        `;
    }
  }

  private _renderButtons(s: DialogState): TemplateResult | typeof nothing {
    if (!s.showConfirmButton && !s.showCancelButton) return nothing;

    return html`
      <div class="actions">
        ${s.showConfirmButton
          ? html`<button class="btn btn-confirm" @click=${() => this.controller.onConfirm()}>
              ${s.confirmButtonText}
            </button>`
          : nothing}
        ${s.showCancelButton
          ? html`<button class="btn btn-cancel" @click=${() => this.controller.onCancel()}>
              ${s.cancelButtonText}
            </button>`
          : nothing}
      </div>
    `;
  }

  // ─── Step Form Helpers ───────────────────────────────────

  private _renderStepFormButtons(s: DialogState): TemplateResult {
    const isFirst = prevStepIndex(s.steps, s.stepIndex) < 0;
    const isLast = nextStepIndex(s.steps, s.stepIndex) < 0;
    const submitText = isLast ? s.stepFormSubmitText : s.stepFormNextText;

    return html`
      <div class="actions actions-step-form">
        <button class="btn btn-cancel" @click=${() => this.controller.onCancel()}>
          ${s.cancelButtonText}
        </button>
        <div class="step-form-nav">
          ${isFirst
            ? nothing
            : html`
                <button class="btn btn-prev" @click=${() => this.controller.onStepPrev()}>
                  ${s.stepFormPrevText}
                </button>
              `}
          <button class="btn btn-confirm" @click=${() => this.controller.onStepNext()}>
            ${submitText}
          </button>
        </div>
      </div>
    `;
  }

  private _renderBody(s: DialogState): TemplateResult {
    switch (s.dialogType) {
      case 'loading':
        return html`
          ${renderSpinner()}
          ${s.label ? html`<p class="label" id="dialog-label">${s.label}</p>` : nothing}
          ${s.html ? html`<div class="html-content">${unsafeHTML(s.html)}</div>` : nothing}
          ${s.description
            ? html`<p class="description" id="dialog-description">${s.description}</p>`
            : nothing}
        `;

      case 'alert':
      case 'confirm':
        return html`
          ${renderAlertIcon(s.icon)}
          ${s.title ? html`<p class="label" id="dialog-label">${s.title}</p>` : nothing}
          ${s.description
            ? html`<p class="description" id="dialog-description">${s.description}</p>`
            : nothing}
          ${s.html ? html`<div class="html-content">${unsafeHTML(s.html)}</div>` : nothing}
        `;

      case 'queue':
        return html`
          ${s.label ? html`<p class="label" id="dialog-label">${s.label}</p>` : nothing}
          ${this._renderQueueList(s.queues)}
        `;

      case 'form': {
        const ctx = this._createFormContext(s);
        return html`
          ${s.title ? html`<p class="label" id="dialog-label">${s.title}</p>` : nothing}
          ${s.description
            ? html`<p class="description" id="dialog-description">${s.description}</p>`
            : nothing}
          <div class="form-scroll-container">
            ${this._renderForm(s.formFields, s.formLayout, ctx)}
          </div>
        `;
      }

      // ステップ表示 (ドット/カウンター/ステップ名) はクロームの担当なので、
      // ここは現在ステップのフォームとナビゲーションだけを描く。
      case 'step-form': {
        if (!s.steps[s.stepIndex]) return html`${nothing}`;
        const ctx = this._createFormContext(s);

        return html`
          ${s.description
            ? html`<p class="description" id="dialog-description">${s.description}</p>`
            : nothing}
          ${s.formFields.length
            ? html`
                <div class="form-scroll-container">
                  ${this._renderForm(s.formFields, s.formLayout, ctx)}
                </div>
              `
            : nothing}
        `;
      }

      default:
        return html`${nothing}`;
    }
  }

  /**
   * ボタン列はスクロールする本文 (.card-body) の外に置く。
   * 本文がビューポートを超えて伸びても、確定/キャンセルは常に見えて押せる。
   */
  private _renderFooter(s: DialogState): TemplateResult | typeof nothing {
    let buttons: TemplateResult | typeof nothing = nothing;

    switch (s.dialogType) {
      case 'alert':
      case 'confirm':
      case 'form':
        buttons = this._renderButtons(s);
        break;
      case 'step-form':
        if (s.steps[s.stepIndex]) buttons = this._renderStepFormButtons(s);
        break;
      default:
        break;
    }

    if (buttons === nothing) return nothing;
    return html`<div class="card-footer">${buttons}</div>`;
  }

  override render(): TemplateResult {
    const s = this._state;
    // While the close animation plays, keep rendering the last *open* state so
    // the card doesn't flash its content back to the reset ('loading') state
    // mid-fade — only the backdrop's open/closed transition uses live state.
    const displayState = this._isClosing ? this._lastOpenState : s;
    // alert/confirm/form は本文側で title を `.label` として描くので、ヘッダーには出さない。
    const showHeaderTitle =
      displayState.title &&
      displayState.dialogType !== 'alert' &&
      displayState.dialogType !== 'confirm' &&
      displayState.dialogType !== 'form';
    // Every label node (`#dialog-title` / `#dialog-step-label` / `#dialog-label`) is only
    // rendered when it has content. Fall back to a static aria-label so the dialog never
    // ends up with no accessible name at all (e.g. showLoading() with no label).
    const hasStepLabel = !!displayState.steps[displayState.stepIndex];
    const hasLabelledByTarget =
      !!displayState.title || !!displayState.label || hasStepLabel;

    return html`
      <div class="backdrop" ?data-open=${s.open} @click=${this._onBackdropClick}>
        <div
          class="card"
          data-type=${displayState.dialogType}
          style=${styleMap(
            // 幅は型別の既定 (CSS) をインラインのカスタムプロパティで上書きする。
            // 指定なしのときは何も書かず、テーマ側の --dialog-* をそのまま活かす。
            displayState.width ? { '--dialog-width': displayState.width } : {}
          )}
          ?data-closing=${this._isClosing}
          role="dialog"
          aria-modal="true"
          aria-labelledby=${hasLabelledByTarget
            ? 'dialog-title dialog-step-label dialog-label'
            : nothing}
          aria-label=${hasLabelledByTarget ? nothing : this.controller.texts.dialogAriaLabel}
          aria-describedby="dialog-description"
          tabindex="-1"
          @keydown=${this._onCardKeyDown}
        >
          ${showHeaderTitle
            ? html`<p class="dialog-title" id="dialog-title">${displayState.title}</p>`
            : nothing}
          ${this._renderStepsChrome(displayState)}
          <div class="card-body">
            ${keyed(
              this._bodyKey,
              html`<div class="body-inner">${this._renderBody(displayState)}</div>`
            )}
          </div>
          ${keyed(this._bodyKey, this._renderFooter(displayState))}
          <div
            class="progress-bar"
            style="width:${displayState.progress ?? 0}%;opacity:${displayState.progress !== null
              ? 1
              : 0}"
          ></div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'overlay-dialog': OverlayDialog;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('overlay-dialog')) {
  customElements.define('overlay-dialog', OverlayDialog);
}
