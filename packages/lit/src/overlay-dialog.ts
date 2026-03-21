import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import type { DialogController } from './controller';
import type { AlertIcon, DialogState, QueueItem, StepItem } from './types';
import { createInitialState } from './types';
import { overlayStyles } from './styles';

@customElement('overlay-dialog')
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

  private _renderBody(): TemplateResult {
    const s = this._state;

    switch (s.dialogType) {
      case 'loading':
        return html`
          ${this._renderSpinner()} ${s.label ? html`<p class="label">${s.label}</p>` : nothing}
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

      default:
        return html`${nothing}`;
    }
  }

  override render(): TemplateResult {
    const s = this._state;
    const showHeaderTitle = s.title && s.dialogType !== 'alert' && s.dialogType !== 'confirm';

    return html`
      <div class="backdrop" ?data-open=${s.open} @click=${this._onBackdropClick}>
        <div class="card" ?data-closing=${this._isClosing}>
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
