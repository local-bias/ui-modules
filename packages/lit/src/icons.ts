import { html, nothing, type TemplateResult } from 'lit';
import type { AlertIcon, QueueItem } from './types';

// ─── Alert/confirm icon ─────────────────────────────────────

export function renderAlertIcon(icon: AlertIcon | null): TemplateResult | typeof nothing {
  if (!icon) return nothing;

  if (icon === 'success') {
    return html`
      <svg class="icon-container" viewBox="0 0 64 64" style="width:64px;height:64px;background:none;">
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
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
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

// ─── Loading spinner ────────────────────────────────────────

export function renderSpinner(): TemplateResult {
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

// ─── Queue/step task icon ───────────────────────────────────

export function renderTaskIcon(status: QueueItem['status']): TemplateResult {
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
