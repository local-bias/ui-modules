import { css } from 'lit';

export const overlayStyles = css`
  :host {
    /* ─── Customizable CSS Variables ─── */
    --dialog-font-family:
      'Yu Gothic Medium', '游ゴシック', YuGothic, 'メイリオ', 'Hiragino Kaku Gothic ProN', Meiryo,
      sans-serif;
    --dialog-text-color: #356;
    --dialog-font-size: 15px;
    --dialog-font-size-desktop: 17px;
    --dialog-z-index: 1000;
    --dialog-backdrop-color: rgb(255 255 255 / 0.73);
    --dialog-backdrop-blur: 4px;
    --dialog-transition-duration: 280ms;

    /* Card */
    --dialog-card-bg: #fff;
    --dialog-card-border: #f3f4f6;
    --dialog-card-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
    --dialog-card-radius: 4px;
    --dialog-card-width: 400px;
    --dialog-alert-width: 480px;
    --dialog-card-min-height: 200px;
    --dialog-card-padding: 24px;
    --dialog-card-padding-desktop: 32px;

    /* Colors */
    --dialog-primary: #3b82f6;
    --dialog-primary-hover: #2563eb;
    --dialog-success: #22c55e;
    --dialog-error: #ef4444;
    --dialog-warning: #f59e0b;
    --dialog-info: #3b82f6;

    /* Progress */
    --dialog-progress-height: 2px;
    --dialog-progress-color: var(--dialog-primary-hover);
    --dialog-progress-transition: all 350ms ease;

    /* Button */
    --dialog-btn-radius: 6px;
    --dialog-btn-padding: 8px 24px;
    --dialog-btn-font-size: 15px;

    /* Spinner */
    --dialog-spinner-size: 60px;
    --dialog-spinner-track: rgb(59 130 246 / 0.2);
    --dialog-spinner-arc: var(--dialog-primary);

    /* Form */
    --dialog-form-width: 500px;
    --dialog-form-max-height: 60vh;
    --dialog-form-gap: 16px;
    --dialog-form-columns: 1;
    --dialog-form-label-color: #374151;
    --dialog-form-label-size: 14px;
    --dialog-form-label-weight: 500;
    --dialog-form-input-bg: #fff;
    --dialog-form-input-border: #d1d5db;
    --dialog-form-input-border-focus: var(--dialog-primary);
    --dialog-form-input-radius: 6px;
    --dialog-form-input-padding: 8px 12px;
    --dialog-form-input-font-size: 15px;
    --dialog-form-error-color: var(--dialog-error);
    --dialog-form-hint-color: #9ca3af;
    --dialog-form-required-color: var(--dialog-error);

    display: contents;
    font-family: var(--dialog-font-family);
    color: var(--dialog-text-color);
    font-size: var(--dialog-font-size);
  }

  /* ─── Backdrop ─── */

  .backdrop {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    display: grid;
    place-items: end stretch;
    z-index: var(--dialog-z-index);
    overflow: hidden;
    background-color: var(--dialog-backdrop-color);
    backdrop-filter: blur(var(--dialog-backdrop-blur));
    box-sizing: border-box;
    transition: opacity var(--dialog-transition-duration) ease;
    opacity: 0;
    pointer-events: none;
  }

  .backdrop[data-open] {
    opacity: 1;
    pointer-events: all;
  }

  @media (min-width: 640px) {
    :host {
      font-size: var(--dialog-font-size-desktop);
    }
    .backdrop {
      place-items: center;
    }
  }

  /* ─── Card ─── */

  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 0;
    padding: var(--dialog-card-padding);
    background-color: var(--dialog-card-bg);
    border-radius: 0;
    box-shadow: var(--dialog-card-shadow);
    border: 1px solid var(--dialog-card-border);
    min-height: var(--dialog-card-min-height);
    position: relative;
    overflow: hidden;
  }

  @media (min-width: 640px) {
    .card {
      width: var(--dialog-card-width);
      max-width: 90vw;
      border-radius: var(--dialog-card-radius);
      padding: var(--dialog-card-padding-desktop);
      transition: width 360ms cubic-bezier(0.16, 1, 0.3, 1);
    }
  }

  /* ─── Alert / Confirm specific sizing ─── */

  @media (min-width: 640px) {
    .card[data-type='alert'],
    .card[data-type='confirm'] {
      width: var(--dialog-alert-width);
    }
  }

  .card[data-type='alert'] .label,
  .card[data-type='confirm'] .label {
    font-size: 22px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.01em;
  }

  /* ─── Card Open / Close Animations ─── */

  @keyframes card-enter {
    from {
      opacity: 0;
      transform: translateY(28px) scale(0.96);
      filter: blur(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
      filter: blur(0);
    }
  }

  @keyframes card-exit {
    from {
      opacity: 1;
      transform: translateY(0) scale(1);
      filter: blur(0);
    }
    to {
      opacity: 0;
      transform: translateY(14px) scale(0.97);
      filter: blur(4px);
    }
  }

  .backdrop[data-open] .card {
    animation: card-enter 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .card[data-closing] {
    animation: card-exit 300ms cubic-bezier(0.4, 0, 1, 1) both;
    pointer-events: none;
  }

  /* ─── Card Body ─── */

  .card-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    width: 100%;
  }

  /* ─── Body Inner (animated content wrapper) ─── */

  @keyframes body-enter {
    from {
      opacity: 0;
      transform: translateY(10px);
      filter: blur(3px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
      filter: blur(0);
    }
  }

  .body-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: 100%;
    animation: body-enter 380ms 60ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  /* ─── Spinner ─── */

  @keyframes spinner-enter {
    from {
      opacity: 0;
      transform: scale(0.5);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .spinner-wrap {
    font-size: var(--dialog-spinner-size);
    width: 1em;
    height: 1em;
    animation: spinner-enter 450ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  .spinner {
    width: 1em;
    height: 1em;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px var(--dialog-spinner-track);
    position: relative;
    animation: spin 1.2s infinite linear;
  }

  .spinner-half {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 0.5em;
    height: 1em;
    margin-left: -0.5em;
    margin-top: -0.5em;
    overflow: hidden;
    transform-origin: 0.5em 0.5em;
    mask-image: linear-gradient(to bottom, #000f, #0000);
    -webkit-mask-image: linear-gradient(to bottom, #000f, #0000);
  }

  .spinner-inner {
    width: 1em;
    height: 1em;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px var(--dialog-spinner-arc);
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  /* ─── Icon ─── */

  @keyframes icon-enter {
    from {
      opacity: 0;
      transform: scale(0.4) rotate(-12deg);
      filter: blur(4px);
    }
    to {
      opacity: 1;
      transform: scale(1) rotate(0deg);
      filter: blur(0);
    }
  }

  .icon-container {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    animation: icon-enter 500ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  .icon-container svg {
    width: 36px;
    height: 36px;
  }

  .icon-success {
    background-color: rgb(34 197 94 / 0.1);
    color: var(--dialog-success);
  }

  .icon-error {
    background-color: rgb(239 68 68 / 0.1);
    color: var(--dialog-error);
  }

  .icon-warning {
    background-color: rgb(245 158 11 / 0.1);
    color: var(--dialog-warning);
  }

  .icon-info {
    background-color: rgb(59 130 246 / 0.1);
    color: var(--dialog-info);
  }

  /* ─── Check Animation ─── */

  .check-circle {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    stroke-width: 2;
    stroke: var(--dialog-success);
    fill: none;
    stroke-dasharray: 200;
    stroke-dashoffset: 200;
    animation: check-circle-draw 0.6s ease forwards;
  }

  .check-mark {
    stroke: var(--dialog-success);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
    stroke-dasharray: 50;
    stroke-dashoffset: 50;
    animation: check-mark-draw 0.4s 0.4s ease forwards;
  }

  @keyframes check-circle-draw {
    to {
      stroke-dashoffset: 0;
    }
  }

  @keyframes check-mark-draw {
    to {
      stroke-dashoffset: 0;
    }
  }

  /* ─── Text ─── */

  .dialog-title {
    font-size: 20px;
    font-weight: 600;
    color: #1f2937;
    text-align: center;
    margin: 0 0 16px;
    word-break: break-word;
    width: 100%;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--dialog-card-border);
  }

  .label {
    font-size: 17px;
    font-weight: 500;
    color: #111827;
    text-align: center;
    margin: 0;
    word-break: break-word;
  }

  .description {
    font-size: 15px;
    color: #4b5563;
    text-align: center;
    margin: 0;
    word-break: break-word;
    line-height: 1.65;
  }

  .html-content {
    font-size: 15px;
    color: #4b5563;
    text-align: center;
    word-break: break-word;
    line-height: 1.65;
    width: 100%;
  }

  /* ─── Progress ─── */

  .progress-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 0%;
    height: var(--dialog-progress-height);
    background-color: var(--dialog-progress-color);
    transition: var(--dialog-progress-transition);
  }

  /* ─── Buttons ─── */

  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    margin-top: 8px;
    animation: body-enter 320ms 160ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @media (min-width: 640px) {
    .actions {
      flex-direction: row;
      justify-content: center;
    }
  }

  .btn {
    padding: var(--dialog-btn-padding);
    font-size: var(--dialog-btn-font-size);
    font-family: inherit;
    border: none;
    border-radius: var(--dialog-btn-radius);
    cursor: pointer;
    font-weight: 500;
    transition:
      background-color 150ms ease,
      transform 80ms ease,
      box-shadow 150ms ease;
    min-width: 100px;
    text-align: center;
  }

  .btn:active {
    transform: scale(0.97);
  }

  .btn-confirm {
    background-color: var(--dialog-primary);
    color: #fff;
  }

  .btn-confirm:hover {
    background-color: var(--dialog-primary-hover);
    box-shadow: 0 4px 12px rgb(59 130 246 / 0.35);
  }

  .btn-cancel {
    background-color: #f3f4f6;
    color: #374151;
  }

  .btn-cancel:hover {
    background-color: #e5e7eb;
  }

  /* ─── Queue / Steps list ─── */

  .task-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  @keyframes task-item-enter {
    from {
      opacity: 0;
      transform: translateX(-8px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .task-item {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 15px;
    animation: task-item-enter 300ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .task-item:nth-child(1) {
    animation-delay: 40ms;
  }
  .task-item:nth-child(2) {
    animation-delay: 80ms;
  }
  .task-item:nth-child(3) {
    animation-delay: 120ms;
  }
  .task-item:nth-child(4) {
    animation-delay: 160ms;
  }
  .task-item:nth-child(5) {
    animation-delay: 200ms;
  }
  .task-item:nth-child(6) {
    animation-delay: 240ms;
  }
  .task-item:nth-child(7) {
    animation-delay: 280ms;
  }
  .task-item:nth-child(8) {
    animation-delay: 320ms;
  }

  .task-icon {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .task-icon svg {
    width: 20px;
    height: 20px;
  }

  .task-icon .mini-spinner {
    font-size: 20px;
    width: 1em;
    height: 1em;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px var(--dialog-spinner-track);
    position: relative;
    animation: spin 1.2s infinite linear;
  }

  .task-icon .mini-spinner-half {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 0.5em;
    height: 1em;
    margin-left: -0.5em;
    margin-top: -0.5em;
    overflow: hidden;
    transform-origin: 0.5em 0.5em;
    mask-image: linear-gradient(to bottom, #000f, #0000);
    -webkit-mask-image: linear-gradient(to bottom, #000f, #0000);
  }

  .task-icon .mini-spinner-inner {
    width: 1em;
    height: 1em;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px var(--dialog-spinner-arc);
  }

  .task-label {
    color: #6b7280;
    transition: color 250ms ease;
  }

  .task-label[data-status='active'] {
    color: var(--dialog-text-color);
    font-weight: 500;
  }

  @keyframes task-done-flash {
    0% {
      transform: translateX(0);
    }
    30% {
      transform: translateX(4px);
    }
    100% {
      transform: translateX(0);
    }
  }

  .task-label[data-status='done'] {
    color: var(--dialog-success);
    animation: task-done-flash 350ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  .task-label[data-status='error'] {
    color: var(--dialog-error);
  }

  .task-label[data-status='skipped'] {
    color: #9ca3af;
  }

  /* ─── Queue ellipsis ─── */

  .queue-ellipsis {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 4px 0;
    /* アイコン列 (24px) の中央に配置: (24px - 4px dot) / 2 = 10px */
    padding-left: 10px;
    align-self: flex-start;
    list-style: none;
  }

  .queue-ellipsis span {
    display: block;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background-color: #d1d5db;
  }

  /* ─── Steps indicator ─── */

  .steps-header {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    justify-content: center;
    margin-bottom: 8px;
  }

  @keyframes step-dot-enter {
    from {
      opacity: 0;
      transform: scale(0.4);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes step-pulse {
    0% {
      box-shadow:
        0 0 0 0 rgb(59 130 246 / 0.5),
        0 0 0 3px rgb(59 130 246 / 0.2);
    }
    70% {
      box-shadow:
        0 0 0 7px rgb(59 130 246 / 0),
        0 0 0 3px rgb(59 130 246 / 0.2);
    }
    100% {
      box-shadow:
        0 0 0 0 rgb(59 130 246 / 0),
        0 0 0 3px rgb(59 130 246 / 0.2);
    }
  }

  .step-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #d1d5db;
    transition:
      background-color 250ms ease,
      transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1),
      width 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
    animation: step-dot-enter 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  .step-dot[data-status='active'] {
    background-color: var(--dialog-primary);
    width: 20px;
    border-radius: 4px;
    animation:
      step-dot-enter 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both,
      step-pulse 2s 400ms infinite;
  }

  .step-dot[data-status='done'] {
    background-color: var(--dialog-success);
  }

  .step-dot[data-status='error'] {
    background-color: var(--dialog-error);
  }

  .step-dot[data-status='skipped'] {
    background-color: #9ca3af;
  }

  .step-connector {
    flex: 1;
    max-width: 24px;
    height: 2px;
    background-color: #e5e7eb;
    transition: background-color 400ms ease;
  }

  /* ─── Form ─── */

  @media (min-width: 640px) {
    .card[data-type='form'] {
      width: var(--dialog-form-width);
    }
  }

  .form-scroll-container {
    max-height: var(--dialog-form-max-height);
    overflow-y: auto;
    width: 100%;
    padding: 4px 0;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(var(--dialog-form-columns, 1), 1fr);
    gap: var(--dialog-form-gap);
    width: 100%;
  }

  @media (max-width: 639px) {
    .form-grid {
      grid-template-columns: 1fr !important;
    }
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
  }

  .form-field[data-type='checkbox'] {
    grid-column: 1 / -1;
  }

  .form-label {
    font-size: var(--dialog-form-label-size);
    font-weight: var(--dialog-form-label-weight);
    color: var(--dialog-form-label-color);
  }

  .form-required {
    color: var(--dialog-form-required-color);
    margin-left: 2px;
  }

  .form-input,
  .form-select {
    padding: var(--dialog-form-input-padding);
    font-size: var(--dialog-form-input-font-size);
    font-family: inherit;
    background: var(--dialog-form-input-bg);
    border: 1px solid var(--dialog-form-input-border);
    border-radius: var(--dialog-form-input-radius);
    color: var(--dialog-text-color);
    outline: none;
    transition:
      border-color 150ms ease,
      box-shadow 150ms ease;
    width: 100%;
    box-sizing: border-box;
  }

  .form-input:focus,
  .form-select:focus {
    border-color: var(--dialog-form-input-border-focus);
    box-shadow: 0 0 0 3px rgb(59 130 246 / 0.1);
  }

  .form-field[data-error] .form-input,
  .form-field[data-error] .form-select {
    border-color: var(--dialog-form-error-color);
  }

  .form-field[data-error] .form-input:focus,
  .form-field[data-error] .form-select:focus {
    box-shadow: 0 0 0 3px rgb(239 68 68 / 0.1);
  }

  .form-error {
    font-size: 13px;
    color: var(--dialog-form-error-color);
    min-height: 1em;
  }

  .form-hint {
    font-size: 13px;
    color: var(--dialog-form-hint-color);
  }

  .form-checkbox {
    width: 18px;
    height: 18px;
    accent-color: var(--dialog-primary);
    cursor: pointer;
    flex-shrink: 0;
  }

  .form-checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: var(--dialog-form-input-font-size);
    color: var(--dialog-form-label-color);
  }

  .form-checkbox-text {
    font-size: var(--dialog-form-label-size);
    font-weight: var(--dialog-form-label-weight);
    color: var(--dialog-form-label-color);
  }

  .form-group {
    border: 1px solid var(--dialog-card-border);
    border-radius: var(--dialog-form-input-radius);
    padding: 16px;
    margin: 0 0 8px;
    width: 100%;
    box-sizing: border-box;
  }

  .form-group-label {
    font-size: var(--dialog-form-label-size);
    font-weight: 600;
    color: var(--dialog-form-label-color);
    padding: 0 4px;
  }

  /* ─── Step Form ─── */

  @media (min-width: 640px) {
    .card[data-type='step-form'] {
      width: var(--dialog-form-width);
    }
  }

  .step-form-counter {
    font-size: 13px;
    color: var(--dialog-form-hint-color);
    text-align: center;
    margin: 0 0 4px;
  }

  .actions-step-form {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-top: 20px;
    width: 100%;
  }

  .step-form-nav {
    display: flex;
    flex-direction: row;
    gap: 8px;
    align-items: center;
  }

  .btn-prev {
    padding: var(--dialog-btn-padding);
    font-size: var(--dialog-btn-font-size);
    font-family: inherit;
    font-weight: 500;
    border-radius: var(--dialog-btn-radius);
    cursor: pointer;
    border: 1px solid var(--dialog-form-input-border);
    background: transparent;
    color: var(--dialog-text-color);
    transition:
      background-color 120ms ease,
      border-color 120ms ease;
  }

  .btn-prev:hover {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  .btn-prev:active {
    transform: scale(0.98);
  }

  @media (max-width: 639px) {
    .actions-step-form {
      flex-direction: column-reverse;
    }

    .step-form-nav {
      width: 100%;
      justify-content: flex-end;
    }
  }
`;
