import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import type { ToastController } from './controller';
import type { ToastItem, ToastState, ToastType } from './types';
import { createInitialToastState } from './types';
import { toastStyles } from './styles';

export class ToastContainer extends LitElement {
  static override styles = toastStyles;

  @property({ attribute: false })
  controller!: ToastController;

  @state() private _state: ToastState = createInitialToastState();

  private _unsubscribe?: () => void;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.controller) {
      this._state = { ...this.controller.state };
      this._unsubscribe = this.controller.subscribe((s) => {
        this._state = s;
      });
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubscribe?.();
  }

  // ─── Icon Rendering ─────────────────────────────────────

  private _renderIcon(type: ToastType): TemplateResult {
    switch (type) {
      case 'success':
        return html`<svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
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
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>`;
      case 'warning':
        return html`<svg
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
        </svg>`;
      case 'info':
        return html`<svg
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
        </svg>`;
      case 'loading':
        return html`
          <div class="toast-spinner">
            <div class="toast-spinner-half">
              <div class="toast-spinner-inner"></div>
            </div>
          </div>
        `;
    }
  }

  // ─── Toast Rendering ────────────────────────────────────

  private _renderToast(item: ToastItem): TemplateResult {
    return html`
      <div class="toast-slot" ?data-dismissing=${item.dismissing}>
        <div
          class="toast-card"
          data-type=${item.type}
          ?data-dismissing=${item.dismissing}
          ?data-paused=${item.paused}
          role=${item.type === 'error' ? 'alert' : 'status'}
          @mouseenter=${() => this.controller.pauseTimer(item.id)}
          @mouseleave=${() => this.controller.resumeTimer(item.id)}
        >
          <div class="toast-body">
            <span class="toast-icon icon-${item.type}"> ${this._renderIcon(item.type)} </span>
            <div class="toast-text">
              <p class="toast-message" ?data-titled=${!!item.description}>${item.message}</p>
              ${item.description
                ? html`<p class="toast-description">${item.description}</p>`
                : nothing}
              ${item.action
                ? html`<button
                    class="toast-action-btn"
                    @click=${() => {
                      item.action!.onClick();
                      this.controller.dismiss(item.id);
                    }}
                  >
                    ${item.action.label}
                  </button>`
                : nothing}
            </div>
            <div class="toast-close-wrap">
              ${item.duration > 0 && item.type !== 'loading'
                ? html`<svg class="toast-timer-ring" viewBox="0 0 24 24" aria-hidden="true">
                    <circle class="toast-timer-track" cx="12" cy="12" r="10" />
                    <circle
                      class="toast-timer-fill"
                      cx="12"
                      cy="12"
                      r="10"
                      style="animation-duration:${item.duration}ms"
                    />
                  </svg>`
                : nothing}
              <button
                class="toast-close"
                @click=${() => this.controller.dismiss(item.id)}
                aria-label=${this.controller.texts.closeLabel}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ─── Main Render ────────────────────────────────────────

  override render(): TemplateResult {
    const s = this._state;

    return html`
      <div
        class="container"
        data-position=${s.position}
        role="region"
        aria-label=${this.controller.texts.regionLabel}
      >
        <!--
          No aria-live here: each toast card below carries its own role="status"/"alert",
          which already establishes a per-item live region. Adding aria-live on the
          container too would nest live regions — a documented anti-pattern that causes
          inconsistent double-announcement across screen readers.
        -->
        ${repeat(
          s.items,
          (item) => item.id,
          (item) => this._renderToast(item)
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'toast-container': ToastContainer;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('toast-container')) {
  customElements.define('toast-container', ToastContainer);
}
