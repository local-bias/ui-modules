// ─── Dialog Types ────────────────────────────────────────────

export type DialogType = 'loading' | 'alert' | 'confirm' | 'queue' | 'steps' | 'form' | 'step-form';
export type AlertIcon = 'success' | 'error' | 'warning' | 'info';
export type QueueItemStatus = 'pending' | 'active' | 'done' | 'skipped' | 'error';
export type StepItemStatus = 'pending' | 'active' | 'done' | 'skipped' | 'error';

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
  layout?: FormLayout;
  defaultValues?: Partial<T>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

// ─── Step Form Types ─────────────────────────────────────────

/** フォームを持つ1ステップの描画状態 (コントローラー内部で管理) */
export interface StepFormItem {
  key: string;
  label: string;
  description: string;
  fields: FormFieldMeta[];
  values: Record<string, unknown>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  layout: FormLayout;
}

/** `showStepForm()` に渡す各ステップの定義 */
export interface StepFormStepInput {
  key: string;
  label: string;
  description?: string;
  /** Zod スキーマ。省略するとフォームなし (説明のみ) のステップになる */
  schema?: { _def: any; safeParse: (data: unknown) => any };
  layout?: FormLayout;
  defaultValues?: Record<string, unknown>;
}

/** `showStepForm()` のオプション */
export interface StepFormOptions {
  title?: string;
  allowOutsideClick?: boolean;
  allowEscapeKey?: boolean;
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
  html?: string;
  icon?: AlertIcon;
  progress?: number;
  allowOutsideClick?: boolean;
}

export interface AlertOptions {
  type?: AlertIcon;
  title?: string;
  description?: string;
  html?: string;
  showCancelButton?: boolean;
  confirmButtonText?: string;
  cancelButtonText?: string;
  allowOutsideClick?: boolean;
  allowEscapeKey?: boolean;
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
  queues: QueueItem[];
  steps: StepItem[];
  timer: number | null;
  title: string;
  formFields: FormFieldMeta[];
  formValues: Record<string, unknown>;
  formErrors: Record<string, string>;
  formTouched: Record<string, boolean>;
  formLayout: FormLayout;
  formValidateOnChange: boolean;
  formValidateOnBlur: boolean;
  stepFormSteps: StepFormItem[];
  stepFormCurrentIndex: number;
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
  confirmButtonText: 'OK',
  cancelButtonText: 'キャンセル',
  allowOutsideClick: true,
  allowEscapeKey: true,
  queues: [],
  steps: [],
  timer: null,
  title: '',
  formFields: [],
  formValues: {},
  formErrors: {},
  formTouched: {},
  formLayout: {},
  formValidateOnChange: true,
  formValidateOnBlur: true,
  stepFormSteps: [],
  stepFormCurrentIndex: 0,
  stepFormNextText: '次へ',
  stepFormPrevText: '戻る',
  stepFormSubmitText: 'OK',
});
