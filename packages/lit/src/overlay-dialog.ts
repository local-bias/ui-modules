import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import type { DialogController } from './controller';
import type {
  AlertIcon,
  DialogState,
  FormFieldGroup,
  FormFieldMeta,
  FormLayout,
  QueueItem,
  StepItem,
} from './types';
import { createInitialState } from './types';
import { overlayStyles } from './styles';

// ─── Form rendering context ───────────────────────────────────
// Abstracts data access so form rendering methods work for both
// 'form' and 'step-form' dialog types without code duplication.

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

  private _unsubscribe?: () => void;
  private _closeTimer?: ReturnType<typeof setTimeout>;
  private _beforeUnloadHandler = (e: BeforeUnloadEvent) => e.preventDefault();

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.controller) {
      this._state = { ...this.controller.state };
      this._unsubscribe = this.controller.subscribe((s) => {
        const wasOpen = this._state.open;
        const prevDialogType = this._state.dialogType;
        const prevStepIndex = this._state.stepFormCurrentIndex;

        if (s.open && !wasOpen) {
          this._isClosing = false;
          clearTimeout(this._closeTimer);
          window.addEventListener('beforeunload', this._beforeUnloadHandler);
        } else if (!s.open && wasOpen) {
          this._isClosing = true;
          clearTimeout(this._closeTimer);
          this._closeTimer = setTimeout(() => {
            this._isClosing = false;
          }, 320);
          window.removeEventListener('beforeunload', this._beforeUnloadHandler);
        }

        if (s.open && s.dialogType !== prevDialogType) {
          this._bodyKey++;
        } else if (
          s.open &&
          s.dialogType === 'step-form' &&
          s.stepFormCurrentIndex !== prevStepIndex
        ) {
          // re-animate body when navigating between steps
          this._bodyKey++;
        }

        this._state = s;
        this._syncBodyScroll(s.open);
      });
    }
    window.addEventListener('keydown', this._onKeyDown);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubscribe?.();
    this._syncBodyScroll(false);
    clearTimeout(this._closeTimer);
    window.removeEventListener('beforeunload', this._beforeUnloadHandler);
    window.removeEventListener('keydown', this._onKeyDown);
  }

  private _syncBodyScroll(lock: boolean): void {
    if (lock) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  // ─── Event Handlers ──────────────────────────────────────

  private _onBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      this.controller.onOutsideClick();
    }
  }

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this._state.open) {
      this.controller.onEscapeKey();
    }
  };

  // ─── Render Helpers ──────────────────────────────────────

  private _renderIcon(icon: AlertIcon | null): TemplateResult | typeof nothing {
    if (!icon) return nothing;

    if (icon === 'success') {
      return html`
        <svg
          class="icon-container"
          viewBox="0 0 64 64"
          style="width:64px;height:64px;background:none;"
        >
          <circle class="check-circle" cx="32" cy="32" r="30" />
          <polyline class="check-mark" points="20,34 28,42 44,24" />
        </svg>
      `;
    }

    const paths: Record<string, TemplateResult> = {
      error: html`<svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>`,
      warning: html`<svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>`,
      info: html`<svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>`,
    };

    return html` <div class="icon-container icon-${icon}">${paths[icon] ?? nothing}</div> `;
  }

  private _renderSpinner(): TemplateResult {
    return html`
      <div class="spinner-wrap">
        <div class="spinner">
          <div class="spinner-half">
            <div class="spinner-inner"></div>
          </div>
        </div>
      </div>
    `;
  }

  private _renderTaskIcon(status: QueueItem['status']): TemplateResult {
    switch (status) {
      case 'active':
        return html`
          <div class="mini-spinner">
            <div class="mini-spinner-half">
              <div class="mini-spinner-inner"></div>
            </div>
          </div>
        `;
      case 'done':
        return html`<svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#22c55e"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="9,12 11,14 15,10" />
        </svg>`;
      case 'error':
        return html`<svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ef4444"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>`;
      case 'skipped':
        return html`<svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9ca3af"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>`;
      case 'pending':
      default:
        return html`<svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#d1d5db"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
        </svg>`;
    }
  }

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

    return html`
      <ul class="task-list">
        ${start > 0
          ? html`<li class="queue-ellipsis" aria-hidden="true">
              <span></span><span></span><span></span>
            </li>`
          : nothing}
        ${visible.map(
          (item) => html`
            <li class="task-item">
              <span class="task-icon">${this._renderTaskIcon(item.status)}</span>
              <span class="task-label" data-status=${item.status}>${item.label}</span>
            </li>
          `
        )}
        ${end < total - 1
          ? html`<li class="queue-ellipsis" aria-hidden="true">
              <span></span><span></span><span></span>
            </li>`
          : nothing}
      </ul>
    `;
  }

  private _renderStepsHeader(items: StepItem[]): TemplateResult {
    const fragments: TemplateResult[] = [];
    items.forEach((item, i) => {
      if (i > 0) {
        fragments.push(html`<div class="step-connector"></div>`);
      }
      fragments.push(html`<div class="step-dot" data-status=${item.status}></div>`);
    });
    return html`<div class="steps-header">${fragments}</div>`;
  }

  private _renderStepsList(items: StepItem[]): TemplateResult {
    return html`
      ${this._renderStepsHeader(items)}
      <ul class="task-list">
        ${items.map(
          (item) => html`
            <li class="task-item">
              <span class="task-icon">${this._renderTaskIcon(item.status)}</span>
              <span class="task-label" data-status=${item.status}>${item.label}</span>
            </li>
          `
        )}
      </ul>
    `;
  }

  // ─── Form Helpers ────────────────────────────────────────

  private _createFormContext(): FormContext {
    const s = this._state;
    return {
      getValue: (k) => s.formValues[k],
      getError: (k) => s.formErrors[k] ?? '',
      getTouched: (k) => !!s.formTouched[k],
      onUpdate: (k, v) => this.controller.updateFormField(k, v),
      onBlur: (k) => this.controller.touchFormField(k),
    };
  }

  private _createStepFormContext(): FormContext {
    const s = this._state;
    const step = s.stepFormSteps[s.stepFormCurrentIndex];
    return {
      getValue: (k) => step?.values[k],
      getError: (k) => step?.errors[k] ?? '',
      getTouched: (k) => !!step?.touched[k],
      onUpdate: (k, v) => this.controller.updateStepFormField(k, v),
      onBlur: (k) => this.controller.touchStepFormField(k),
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
            @change=${(e: Event) => ctx.onUpdate(field.key, (e.target as HTMLSelectElement).value)}
            @blur=${() => ctx.onBlur(field.key)}
          >
            <option value="" ?selected=${!value}>選択してください</option>
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
            .value=${value != null ? String(value) : ''}
            @input=${(e: Event) => {
              const str = (e.target as HTMLInputElement).value;
              ctx.onUpdate(field.key, str || undefined);
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

  private _renderButtons(): TemplateResult | typeof nothing {
    const s = this._state;
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

  private _renderStepFormButtons(): TemplateResult {
    const s = this._state;
    const isFirst = s.stepFormCurrentIndex === 0;
    const isLast = s.stepFormCurrentIndex === s.stepFormSteps.length - 1;
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

  private _deriveStepItems(): StepItem[] {
    const s = this._state;
    return s.stepFormSteps.map((st, i) => {
      let status: StepItem['status'] = 'pending';
      if (i < s.stepFormCurrentIndex) status = 'done';
      else if (i === s.stepFormCurrentIndex) status = 'active';
      return { key: st.key, label: st.label, status };
    });
  }

  private _renderBody(): TemplateResult {
    const s = this._state;

    switch (s.dialogType) {
      case 'loading':
        return html`
          ${this._renderSpinner()} ${s.label ? html`<p class="label">${s.label}</p>` : nothing}
          ${s.html ? html`<div class="html-content">${unsafeHTML(s.html)}</div>` : nothing}
          ${s.description ? html`<p class="description">${s.description}</p>` : nothing}
        `;

      case 'alert':
      case 'confirm':
        return html`
          ${this._renderIcon(s.icon)} ${s.title ? html`<p class="label">${s.title}</p>` : nothing}
          ${s.description ? html`<p class="description">${s.description}</p>` : nothing}
          ${s.html ? html`<div class="html-content">${unsafeHTML(s.html)}</div>` : nothing}
          ${this._renderButtons()}
        `;

      case 'queue':
        return html`
          ${s.label ? html`<p class="label">${s.label}</p>` : nothing}
          ${this._renderQueueList(s.queues)}
        `;

      case 'steps':
        return html`
          ${s.label ? html`<p class="label">${s.label}</p>` : nothing}
          ${this._renderStepsList(s.steps)}
        `;

      case 'form': {
        const ctx = this._createFormContext();
        return html`
          ${s.title ? html`<p class="label">${s.title}</p>` : nothing}
          ${s.description ? html`<p class="description">${s.description}</p>` : nothing}
          <div class="form-scroll-container">
            ${this._renderForm(s.formFields, s.formLayout, ctx)}
          </div>
          ${this._renderButtons()}
        `;
      }

      case 'step-form': {
        const stepItems = this._deriveStepItems();
        const currentStep = s.stepFormSteps[s.stepFormCurrentIndex];
        if (!currentStep) return html`${nothing}`;

        const ctx = this._createStepFormContext();
        const stepCount = s.stepFormSteps.length;
        const counterText = `${s.stepFormCurrentIndex + 1} / ${stepCount}`;

        return html`
          ${this._renderStepsHeader(stepItems)}
          <p class="step-form-counter">${counterText}</p>
          <p class="label">${currentStep.label}</p>
          ${currentStep.description
            ? html`<p class="description">${currentStep.description}</p>`
            : nothing}
          ${currentStep.fields.length
            ? html`
                <div class="form-scroll-container">
                  ${this._renderForm(currentStep.fields, currentStep.layout, ctx)}
                </div>
              `
            : nothing}
          ${this._renderStepFormButtons()}
        `;
      }

      default:
        return html`${nothing}`;
    }
  }

  override render(): TemplateResult {
    const s = this._state;
    const showHeaderTitle =
      s.title &&
      s.dialogType !== 'alert' &&
      s.dialogType !== 'confirm' &&
      s.dialogType !== 'form' &&
      s.dialogType !== 'step-form';

    return html`
      <div class="backdrop" ?data-open=${s.open} @click=${this._onBackdropClick}>
        <div class="card" data-type=${s.dialogType} ?data-closing=${this._isClosing}>
          ${showHeaderTitle ? html`<p class="dialog-title">${s.title}</p>` : nothing}
          <div class="card-body">
            ${keyed(this._bodyKey, html`<div class="body-inner">${this._renderBody()}</div>`)}
          </div>
          <div
            class="progress-bar"
            style="width:${s.progress ?? 0}%;opacity:${s.progress !== null ? 1 : 0}"
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

if (!customElements.get('overlay-dialog')) {
  customElements.define('overlay-dialog', OverlayDialog);
}
