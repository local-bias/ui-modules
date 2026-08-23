// ─── Dialog Types ────────────────────────────────────────────

/**
 * ダイアログ「本文」の種類。ステップインジケータは本文ではなく、
 * `state.steps` の有無だけで決まる常駐クロームなので、ここには含まれない。
 */
export type DialogType = 'loading' | 'alert' | 'confirm' | 'queue' | 'form' | 'step-form';
export type AlertIcon = 'success' | 'error' | 'warning' | 'info';
export type QueueItemStatus = 'pending' | 'active' | 'done' | 'skipped' | 'error';
export type StepItemStatus = 'pending' | 'active' | 'done' | 'skipped' | 'error';

// ─── Width ──────────────────────────────────────────────────

/** 幅トークン。実寸は `--dialog-width-*` で再調整できる。 */
export type DialogWidthToken = 'sm' | 'md' | 'lg' | 'xl' | 'full';

/**
 * ダイアログの幅指定。トークン / 数値 (px として解釈) / CSS 長さ・関数の文字列。
 * 未指定 (`undefined`) は `dialogType` ごとの既定幅を意味する。
 */
export type DialogWidth = DialogWidthToken | number | (string & {});

export interface QueueItem {
  key: string;
  label: string;
  status: QueueItemStatus;
}

export interface StepItem {
  key: string;
  label: string;
  status: StepItemStatus;
}

export type TaskItemInput = string | { key: string; label: string };

// ─── Form Types ─────────────────────────────────────────────

export type FormInputType = 'text' | 'number' | 'checkbox' | 'select' | 'date' | 'email' | 'url';

export interface FormFieldMeta {
  key: string;
  inputType: FormInputType;
  label: string;
  description: string;
  required: boolean;
  options: string[];
  placeholder: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  defaultValue: unknown;
}

export interface FormFieldGroup {
  label?: string;
  fields: string[];
  columns?: number;
}

export interface FormLayout {
  columns?: number;
  gap?: string;
  fieldOrder?: string[];
  groups?: FormFieldGroup[];
}

export interface FormOptions<T = Record<string, unknown>> {
  title?: string;
  description?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  allowOutsideClick?: boolean;
  allowEscapeKey?: boolean;
  /** ダイアログの幅。未指定ならこの `dialogType` の既定幅。 */
  width?: DialogWidth;
  layout?: FormLayout;
  defaultValues?: Partial<T>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

// ─── Steps Types ─────────────────────────────────────────────

/** `showSteps()` のオプション。初期本文 (ローディング) の見た目を指定する。 */
export interface StepsOptions {
  /** カード上部の見出し。ステップインジケータの上に表示される。 */
  title?: string;
  label?: string;
  description?: string;
  allowOutsideClick?: boolean;
  allowEscapeKey?: boolean;
  /** ダイアログの幅。未指定ならこの `dialogType` の既定幅。 */
  width?: DialogWidth;
}

// ─── Step Form Types ─────────────────────────────────────────

/** `showStepForm()` に渡す各ステップの定義 */
export interface StepFormStepInput {
  key: string;
  label: string;
  description?: string;
  /** Zod スキーマ。省略するとフォームなし (説明のみ) のステップになる */
  schema?: { _def: any; safeParse: (data: unknown) => any };
  layout?: FormLayout;
  defaultValues?: Record<string, unknown>;
  /** このステップ表示中の幅。未指定なら `showStepForm()` の `width` にフォールバックする。 */
  width?: DialogWidth;
}

/** `showStepForm()` のオプション */
export interface StepFormOptions {
  title?: string;
  allowOutsideClick?: boolean;
  allowEscapeKey?: boolean;
  /** ダイアログの幅。未指定ならこの `dialogType` の既定幅。 */
  width?: DialogWidth;
  nextButtonText?: string;
  prevButtonText?: string;
  submitButtonText?: string;
  cancelButtonText?: string;
}

// ─── Show Options ────────────────────────────────────────────

export interface ShowOptions {
  type: DialogType;
  label?: string;
  description?: string;
  /** Rendered as raw HTML (via lit's unsafeHTML) — never pass unsanitized user input. */
  html?: string;
  icon?: AlertIcon;
  progress?: number;
  allowOutsideClick?: boolean;
  allowEscapeKey?: boolean;
  /** ダイアログの幅。未指定ならこの `dialogType` の既定幅。 */
  width?: DialogWidth;
}

export interface AlertOptions {
  type?: AlertIcon;
  title?: string;
  description?: string;
  /** Rendered as raw HTML (via lit's unsafeHTML) — never pass unsanitized user input. */
  html?: string;
  showCancelButton?: boolean;
  confirmButtonText?: string;
  cancelButtonText?: string;
  allowOutsideClick?: boolean;
  allowEscapeKey?: boolean;
  /** ダイアログの幅。未指定ならこの `dialogType` の既定幅。 */
  width?: DialogWidth;
  timer?: number;
}

export interface ConfirmOptions {
  title?: string;
  description?: string;
  type?: AlertIcon;
  confirmButtonText?: string;
  cancelButtonText?: string;
  allowOutsideClick?: boolean;
  allowEscapeKey?: boolean;
  /** ダイアログの幅。未指定ならこの `dialogType` の既定幅。 */
  width?: DialogWidth;
}

// ─── Configuration ───────────────────────────────────────────

/** Default button/placeholder text, overridable via `dialog.configure({ texts })` for i18n. */
export interface DialogTexts {
  confirmButtonText?: string;
  cancelButtonText?: string;
  stepFormNextText?: string;
  stepFormPrevText?: string;
  stepFormSubmitText?: string;
  /** Placeholder shown for an empty `<select>` in Zod-driven forms. */
  selectPlaceholder?: string;
  /**
   * Fallback `aria-label` for the dialog when it has no title/label/description
   * to reference (e.g. `showLoading()` with no `label`) — ensures the modal
   * always has an accessible name for screen readers.
   */
  dialogAriaLabel?: string;
}

export const DEFAULT_DIALOG_TEXTS: Required<DialogTexts> = {
  confirmButtonText: 'OK',
  cancelButtonText: 'キャンセル',
  stepFormNextText: '次へ',
  stepFormPrevText: '戻る',
  stepFormSubmitText: 'OK',
  selectPlaceholder: '選択してください',
  dialogAriaLabel: 'ダイアログ',
};

export interface DialogConfig {
  /**
   * Applied to `html`/`setHtml()` content before it's rendered via unsafeHTML.
   * The library does not sanitize by default — provide a vetted sanitizer
   * (e.g. DOMPurify) here if `html` may ever contain untrusted input.
   */
  sanitizeHtml?: (html: string) => string;
  /** Override default button/placeholder text (e.g. for non-Japanese locales). */
  texts?: DialogTexts;
}

// ─── Result ─────────────────────────────────────────────────

export interface DialogResult {
  isConfirmed: boolean;
  isCanceled: boolean;
  isDismissed: boolean;
}

// ─── State ──────────────────────────────────────────────────

export interface DialogState {
  open: boolean;
  dialogType: DialogType;
  icon: AlertIcon | null;
  label: string;
  description: string;
  html: string;
  progress: number | null;
  showConfirmButton: boolean;
  showCancelButton: boolean;
  confirmButtonText: string;
  cancelButtonText: string;
  allowOutsideClick: boolean;
  allowEscapeKey: boolean;
  /**
   * 解決済みの CSS 幅 (`resolveDialogWidth()` の出力)。`null` は「指定なし」で、
   * `dialogType` ごとの既定幅 (CSS 側) にフォールバックすることを意味する。
   */
  width: string | null;
  queues: QueueItem[];
  /**
   * 上部に常駐するステップインジケータ。`dialogType` とは独立していて、
   * 本文がどれに差し替わっても描画され続ける。破棄するのは
   * `clearSteps()` / `hide()`、およびウィザード (`showStepForm()`) の終了時のみ。
   */
  steps: StepItem[];
  /**
   * `steps` 内の現在位置。`activateStep()` でのみ移動する。
   * -1 は「現在ステップなし」(未開始、または全ステップ完了後)。
   */
  stepIndex: number;
  timer: number | null;
  title: string;
  formFields: FormFieldMeta[];
  formValues: Record<string, unknown>;
  formErrors: Record<string, string>;
  formTouched: Record<string, boolean>;
  formLayout: FormLayout;
  formValidateOnChange: boolean;
  formValidateOnBlur: boolean;
  stepFormNextText: string;
  stepFormPrevText: string;
  stepFormSubmitText: string;
}

export const createInitialState = (): DialogState => ({
  open: false,
  dialogType: 'loading',
  icon: null,
  label: '',
  description: '',
  html: '',
  progress: null,
  showConfirmButton: true,
  showCancelButton: false,
  confirmButtonText: DEFAULT_DIALOG_TEXTS.confirmButtonText,
  cancelButtonText: DEFAULT_DIALOG_TEXTS.cancelButtonText,
  allowOutsideClick: true,
  allowEscapeKey: true,
  width: null,
  queues: [],
  steps: [],
  stepIndex: -1,
  timer: null,
  title: '',
  formFields: [],
  formValues: {},
  formErrors: {},
  formTouched: {},
  formLayout: {},
  formValidateOnChange: true,
  formValidateOnBlur: true,
  stepFormNextText: DEFAULT_DIALOG_TEXTS.stepFormNextText,
  stepFormPrevText: DEFAULT_DIALOG_TEXTS.stepFormPrevText,
  stepFormSubmitText: DEFAULT_DIALOG_TEXTS.stepFormSubmitText,
});
