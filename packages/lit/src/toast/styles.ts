import { css } from 'lit';

export const toastStyles = css`
  :host {
    /* ─── Customizable CSS Variables ─── */
    --toast-font-family: var(
      --dialog-font-family,
      'Yu Gothic Medium',
      '游ゴシック',
      YuGothic,
      'メイリオ',
      'Hiragino Kaku Gothic ProN',
      Meiryo,
      sans-serif
    );
    --toast-text-color: var(--dialog-text-color, #356);
    --toast-z-index: 1100;

    /* Container */
    --toast-gap: 12px;
    --toast-padding: 16px;
    --toast-min-width: 360px;
    --toast-max-width: 420px;

    /* Card */
    --toast-card-bg: #fff;
    --toast-card-border: #f3f4f6;
    --toast-card-shadow:
      rgba(9, 30, 66, 0.31) 0px 0px 1px 0px, rgba(9, 30, 66, 0.25) 0px 20px 32px -8px;
    --toast-card-radius: 4px;
    --toast-card-padding: 16px 16px 16px 24px;

    /* Colors (inherit from dialog when available) */
    --toast-success: var(--dialog-success, #22c55e);
    --toast-error: var(--dialog-error, #ef4444);
    --toast-warning: var(--dialog-warning, #f59e0b);
    --toast-info: var(--dialog-info, #3b82f6);
    --toast-loading: var(--dialog-primary, #3b82f6);
    --toast-spinner-track: rgb(59 130 246 / 0.2);
    --toast-spinner-arc: var(--toast-loading);

    /* Close button */
    --toast-close-color: #9ca3af;
    --toast-close-hover-color: #374151;

    /* Timing */
    --toast-enter-duration: 350ms;
    --toast-exit-duration: 200ms;
    --toast-collapse-duration: 200ms;

    display: contents;
    font-family: var(--toast-font-family);
    color: var(--toast-text-color);
  }

  /* ─── Container ─── */

  .container {
    position: fixed;
    z-index: var(--toast-z-index);
    display: flex;
    flex-direction: column;
    gap: var(--toast-gap);
    padding: var(--toast-padding);
    pointer-events: none;
    max-height: 100vh;
    min-width: var(--toast-min-width);
    max-width: var(--toast-max-width);
    box-sizing: border-box;
  }

  /* Position variants */
  .container[data-position='top-right'] {
    top: 0;
    right: 0;
  }
  .container[data-position='top-left'] {
    top: 0;
    left: 0;
  }
  .container[data-position='top-center'] {
    top: 0;
    left: 50%;
    transform: translateX(-50%);
  }
  .container[data-position='bottom-right'] {
    bottom: 0;
    right: 0;
    flex-direction: column-reverse;
  }
  .container[data-position='bottom-left'] {
    bottom: 0;
    left: 0;
    flex-direction: column-reverse;
  }
  .container[data-position='bottom-center'] {
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    flex-direction: column-reverse;
  }

  /* Responsive: full-width on mobile */
  @media (max-width: 639px) {
    .container {
      max-width: 100%;
      min-width: 0;
      width: 100%;
      left: 0;
      right: 0;
      transform: none;
    }
    .container[data-position^='top'] {
      top: 0;
      flex-direction: column;
    }
    .container[data-position^='bottom'] {
      bottom: 0;
      flex-direction: column-reverse;
    }
  }

  /* ─── Direction-based transform variables ─── */

  .container[data-position$='right'] {
    --_enter-x: 110%;
    --_exit-x: 110%;
    --_enter-y: 0;
    --_exit-y: 0;
  }
  .container[data-position$='left'] {
    --_enter-x: -110%;
    --_exit-x: -110%;
    --_enter-y: 0;
    --_exit-y: 0;
  }
  .container[data-position='top-center'] {
    --_enter-x: 0;
    --_exit-x: 0;
    --_enter-y: -100%;
    --_exit-y: -100%;
  }
  .container[data-position='bottom-center'] {
    --_enter-x: 0;
    --_exit-x: 0;
    --_enter-y: 100%;
    --_exit-y: 100%;
  }

  @media (max-width: 639px) {
    .container[data-position^='top'] {
      --_enter-x: 0;
      --_exit-x: 0;
      --_enter-y: -100%;
      --_exit-y: -100%;
    }
    .container[data-position^='bottom'] {
      --_enter-x: 0;
      --_exit-x: 0;
      --_enter-y: 100%;
      --_exit-y: 100%;
    }
  }

  /* ─── Toast Slot (height-collapsing wrapper) ─── */

  .toast-slot {
    display: grid;
    grid-template-rows: 1fr;
    transition: grid-template-rows var(--toast-collapse-duration) ease var(--toast-exit-duration);
    pointer-events: auto;
  }

  .toast-slot[data-dismissing] {
    grid-template-rows: 0fr;
  }

  .toast-slot > .toast-card {
    overflow: hidden;
    min-height: 0;
  }

  /* ─── Toast Card ─── */

  .toast-card {
    background: var(--toast-card-bg);
    border-radius: var(--toast-card-radius);
    box-shadow: var(--toast-card-shadow);
    position: relative;
    overflow: hidden;
    animation: toast-enter var(--toast-enter-duration) cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .toast-card[data-dismissing] {
    animation: toast-exit var(--toast-exit-duration) ease both;
    pointer-events: none;
  }

  /* Type-based left accent bar */
  .toast-card::before {
    content: '';
    position: absolute;
    left: 10px;
    top: 12px;
    bottom: 12px;
    width: 4px;
    border-radius: 9999px;
  }
  .toast-card[data-type='success']::before {
    background: var(--toast-success);
  }
  .toast-card[data-type='error']::before {
    background: var(--toast-error);
  }
  .toast-card[data-type='warning']::before {
    background: var(--toast-warning);
  }
  .toast-card[data-type='info']::before {
    background: var(--toast-info);
  }
  .toast-card[data-type='loading']::before {
    background: var(--toast-loading);
  }

  /* ─── Animations ─── */

  @keyframes toast-enter {
    from {
      opacity: 0;
      transform: translateX(var(--_enter-x, 0)) translateY(var(--_enter-y, 0));
      filter: blur(4px);
    }
    to {
      opacity: 1;
      transform: translateX(0) translateY(0);
      filter: blur(0);
    }
  }

  @keyframes toast-exit {
    from {
      opacity: 1;
      transform: translateX(0) translateY(0);
      filter: blur(0);
    }
    to {
      opacity: 0;
      transform: translateX(var(--_exit-x, 0)) translateY(var(--_exit-y, 0));
      filter: blur(3px);
    }
  }

  /* ─── Body ─── */

  .toast-body {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: var(--toast-card-padding);
  }

  /* ─── Icon ─── */

  .toast-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    margin-top: 1px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toast-icon svg {
    width: 20px;
    height: 20px;
  }

  .icon-success {
    color: var(--toast-success);
  }
  .icon-error {
    color: var(--toast-error);
  }
  .icon-warning {
    color: var(--toast-warning);
  }
  .icon-info {
    color: var(--toast-info);
  }
  .icon-loading {
    color: var(--toast-loading);
  }

  /* ─── Loading Spinner ─── */

  @keyframes toast-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .toast-spinner {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 2px var(--toast-spinner-track);
    position: relative;
    animation: toast-spin 1.2s infinite linear;
    flex-shrink: 0;
  }

  .toast-spinner-half {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 10px;
    height: 20px;
    margin-left: -10px;
    margin-top: -10px;
    overflow: hidden;
    transform-origin: 10px 10px;
    mask-image: linear-gradient(to bottom, #000f, #0000);
    -webkit-mask-image: linear-gradient(to bottom, #000f, #0000);
  }

  .toast-spinner-inner {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 2px var(--toast-spinner-arc);
  }

  /* ─── Text ─── */

  .toast-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .toast-message {
    font-size: 14px;
    font-weight: 500;
    color: #1f2937;
    margin: 0;
    word-break: break-word;
    line-height: 1.4;
  }

  .toast-message[data-titled] {
    font-weight: 600;
  }

  .toast-description {
    font-size: 13px;
    color: #6b7280;
    margin: 0;
    word-break: break-word;
    line-height: 1.5;
  }

  /* ─── Action Button ─── */

  .toast-action-btn {
    background: none;
    border: none;
    padding: 0;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    color: var(--toast-info);
    cursor: pointer;
    align-self: flex-start;
    transition: color 150ms ease;
  }

  .toast-action-btn:hover {
    color: var(--dialog-primary-hover, #2563eb);
  }

  /* ─── Close Wrap + Timer Ring ─── */

  .toast-close-wrap {
    position: relative;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toast-timer-ring {
    position: absolute;
    inset: 0;
    width: 24px;
    height: 24px;
    transform: rotate(-90deg);
    pointer-events: none;
  }

  .toast-timer-track {
    fill: none;
    stroke: rgb(0 0 0 / 0.08);
    stroke-width: 2;
  }

  .toast-timer-fill {
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    /* 周長 = 2π × 10 ≈ 62.83 */
    stroke-dasharray: 62.83;
    stroke-dashoffset: 62.83;
    animation: toast-ring-fill linear forwards;
    animation-play-state: running;
  }

  @keyframes toast-ring-fill {
    from {
      stroke-dashoffset: 62.83;
    }
    to {
      stroke-dashoffset: 0;
    }
  }

  .toast-card[data-type='success'] .toast-timer-fill {
    stroke: var(--toast-success);
  }
  .toast-card[data-type='error'] .toast-timer-fill {
    stroke: var(--toast-error);
  }
  .toast-card[data-type='warning'] .toast-timer-fill {
    stroke: var(--toast-warning);
  }
  .toast-card[data-type='info'] .toast-timer-fill {
    stroke: var(--toast-info);
  }

  .toast-card[data-paused] .toast-timer-fill {
    animation-play-state: paused;
  }

  /* ─── Close Button ─── */

  .toast-close {
    position: relative;
    z-index: 1;
    width: 20px;
    height: 20px;
    padding: 0;
    margin: 0;
    border: none;
    background: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--toast-close-color);
    transition: color 150ms ease;
    border-radius: 50%;
  }

  .toast-close svg {
    width: 12px;
    height: 12px;
  }

  .toast-close:hover {
    color: var(--toast-close-hover-color);
  }

  @media (min-width: 640px) {
    .toast-close-wrap {
      opacity: 0.5;
      transition: opacity 150ms ease;
    }
    .toast-card:hover .toast-close-wrap {
      opacity: 1;
    }
  }

  /* Keep the loading spinner rotating (it communicates in-progress state) but
     cut every decorative enter/exit animation and transition down to ~instant. */
  @media (prefers-reduced-motion: reduce) {
    *:not(.toast-spinner),
    *:not(.toast-spinner)::before,
    *:not(.toast-spinner)::after {
      animation-duration: 0.01ms !important;
      animation-delay: 0ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;
