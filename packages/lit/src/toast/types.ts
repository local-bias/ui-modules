// ─── Toast Types ────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export type ToastPosition =
  | 'top-right'
  | 'top-left'
  | 'top-center'
  | 'bottom-right'
  | 'bottom-left'
  | 'bottom-center';

// ─── Toast Action ───────────────────────────────────────────

export interface ToastAction {
  label: string;
  onClick: () => void;
}

// ─── Individual Toast State ─────────────────────────────────

export interface ToastItem {
  /** show() が返す一意な ID。dismiss(id) で使用 */
  id: string;
  /** アイコン・色を決定するビジュアルタイプ */
  type: ToastType;
  /** 主メッセージ (description 指定時はタイトルとして太字表示) */
  message: string;
  /** 補足説明 (省略可)。指定時は message が太字タイトルになる */
  description: string;
  /** アクションボタン (省略可) */
  action: ToastAction | null;
  /** 自動非表示までの時間 (ms)。0 = 自動非表示なし */
  duration: number;
  /** 残り時間 (ms)。pause/resume で更新される */
  remainingMs: number;
  /** hover などで一時停止中かどうか */
  paused: boolean;
  /** 退出アニメーション再生中かどうか */
  dismissing: boolean;
}

// ─── User-Facing Options ────────────────────────────────────

export interface ToastOptions {
  type?: ToastType;
  message: string;
  description?: string;
  action?: ToastAction;
  /** 表示時間 (ms)。省略時は defaultDuration。0 = 永続表示 */
  duration?: number;
}

// ─── Configuration ──────────────────────────────────────────

export interface ToastConfig {
  position: ToastPosition;
  maxVisible: number;
  defaultDuration: number;
}

// ─── Container State ────────────────────────────────────────

export interface ToastState {
  items: ToastItem[];
  position: ToastPosition;
  maxVisible: number;
  defaultDuration: number;
}

export const createInitialToastState = (): ToastState => ({
  items: [],
  position: 'bottom-right',
  maxVisible: 3,
  defaultDuration: 4000,
});

// ─── Text overrides (i18n) ──────────────────────────────────

export interface ToastTexts {
  /** aria-label on each toast's close button. */
  closeLabel?: string;
  /** aria-label on the toast container's live region. */
  regionLabel?: string;
}

export const DEFAULT_TOAST_TEXTS: Required<ToastTexts> = {
  closeLabel: '閉じる',
  regionLabel: '通知',
};
