// ─── Dialog Types ────────────────────────────────────────────

export type DialogType = 'loading' | 'alert' | 'confirm' | 'queue' | 'steps';
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

// ─── Show Options ────────────────────────────────────────────

export interface ShowOptions {
  type: DialogType;
  label?: string;
  description?: string;
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
});
