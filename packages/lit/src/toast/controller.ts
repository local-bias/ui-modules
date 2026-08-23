import {
  type ToastConfig,
  type ToastItem,
  type ToastOptions,
  type ToastState,
  type ToastTexts,
  type ToastType,
  createInitialToastState,
  DEFAULT_TOAST_TEXTS,
} from './types';

type Listener = (state: ToastState) => void;

/** dismiss アニメーション完了までの待ち時間 (ms) */
const DISMISS_ANIMATION_MS = 400;

export class ToastController {
  #state: ToastState;
  #listeners = new Set<Listener>();

  // ─── Per-toast timer management ─────────────────────────
  #timers = new Map<string, ReturnType<typeof setTimeout>>();
  #timerStartedAt = new Map<string, number>();
  #dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();
  #nextId = 0;
  #texts: Required<ToastTexts> = { ...DEFAULT_TOAST_TEXTS };

  constructor() {
    this.#state = createInitialToastState();
  }

  // ─── Observable ─────────────────────────────────────────

  get state(): Readonly<ToastState> {
    return this.#state;
  }

  subscribe(fn: Listener): () => void {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #emit(): void {
    const snapshot: ToastState = { ...this.#state, items: [...this.#state.items] };
    for (const fn of this.#listeners) fn(snapshot);
  }

  #update(patch: Partial<ToastState>): void {
    Object.assign(this.#state, patch);
    this.#emit();
  }

  // ─── Configuration ──────────────────────────────────────

  configure(config: Partial<ToastConfig> & { texts?: ToastTexts }): void {
    const patch: Partial<ToastState> = {};
    if (config.position != null) patch.position = config.position;
    if (config.maxVisible != null) patch.maxVisible = config.maxVisible;
    if (config.defaultDuration != null) patch.defaultDuration = config.defaultDuration;
    if (Object.keys(patch).length > 0) this.#update(patch);
    if (config.texts) this.#texts = { ...this.#texts, ...config.texts };
  }

  /** Current effective default texts (built-ins merged with any `configure({ texts })` override). */
  get texts(): Readonly<Required<ToastTexts>> {
    return this.#texts;
  }

  // ─── Show ───────────────────────────────────────────────

  show(options: ToastOptions): string {
    const id = `toast-${++this.#nextId}`;
    const duration = options.duration ?? this.#state.defaultDuration;

    const item: ToastItem = {
      id,
      type: options.type ?? 'info',
      message: options.message,
      description: options.description ?? '',
      action: options.action ?? null,
      duration,
      remainingMs: duration,
      paused: false,
      dismissing: false,
    };

    const items = [...this.#state.items, item];
    this.#update({ items });

    if (duration > 0) {
      this.#startTimer(id, duration);
    }

    this.#enforceMaxVisible();
    return id;
  }

  success(message: string, options?: Omit<ToastOptions, 'type' | 'message'>): string {
    return this.show({ ...options, type: 'success', message });
  }

  error(message: string, options?: Omit<ToastOptions, 'type' | 'message'>): string {
    return this.show({ ...options, type: 'error', message });
  }

  warning(message: string, options?: Omit<ToastOptions, 'type' | 'message'>): string {
    return this.show({ ...options, type: 'warning', message });
  }

  info(message: string, options?: Omit<ToastOptions, 'type' | 'message'>): string {
    return this.show({ ...options, type: 'info', message });
  }

  loading(message: string, options?: Omit<ToastOptions, 'type' | 'message'>): string {
    // loading は duration: 0 がデフォルト (明示的に指定した場合のみ上書き)
    return this.show({ duration: 0, ...options, type: 'loading', message });
  }

  // ─── Dismiss ────────────────────────────────────────────

  dismiss(id: string): void {
    const item = this.#findItem(id);
    if (!item || item.dismissing) return;
    this.#beginDismiss(id);
  }

  dismissAll(): void {
    const pendingAll = this.#dismissTimers.get('__all__');
    if (pendingAll != null) clearTimeout(pendingAll);

    for (const item of this.#state.items) {
      this.#clearTimer(item.id);
      this.#timerStartedAt.delete(item.id);
    }

    const items = this.#state.items.map((item) =>
      item.dismissing ? item : { ...item, dismissing: true, paused: true }
    );
    this.#update({ items });

    const timer = setTimeout(() => {
      this.#dismissTimers.delete('__all__');
      // Only remove items still marked dismissing — anything shown during the
      // animation window (e.g. a new toast.show() call) must survive.
      const remaining = this.#state.items.filter((i) => !i.dismissing);
      this.#update({ items: remaining });
    }, DISMISS_ANIMATION_MS);
    this.#dismissTimers.set('__all__', timer);
  }

  // ─── Update ─────────────────────────────────────────────

  update(
    id: string,
    patch: Partial<Pick<ToastItem, 'message' | 'description' | 'type' | 'action'>> & {
      /** duration を変更する場合に指定。loading→非loading 遷移時は省略で defaultDuration を自動適用 */
      duration?: number;
    }
  ): void {
    const item = this.#findItem(id);
    if (!item || item.dismissing) return;

    const { duration: newDuration, ...rest } = patch;
    const isLeavingLoading =
      item.type === 'loading' && rest.type != null && rest.type !== 'loading';

    if (newDuration !== undefined) {
      // 明示的な duration 変更: タイマーをリセットして新しい時間をセット
      this.#clearTimer(id);
      this.#updateItem(id, {
        ...rest,
        duration: newDuration,
        remainingMs: newDuration,
        paused: false,
      });
      if (newDuration > 0) {
        this.#startTimer(id, newDuration);
      }
    } else if (isLeavingLoading) {
      // loading → 非loading 遷移: defaultDuration で自動的にタイマーを起動
      const autoMs = this.#state.defaultDuration;
      this.#updateItem(id, { ...rest, duration: autoMs, remainingMs: autoMs, paused: false });
      if (autoMs > 0) {
        this.#startTimer(id, autoMs);
      }
    } else {
      this.#updateItem(id, rest);
    }
  }

  // ─── Timer control (called from component) ─────────────

  pauseTimer(id: string): void {
    const item = this.#findItem(id);
    if (!item || item.paused || item.dismissing || item.duration <= 0) return;

    const startedAt = this.#timerStartedAt.get(id);
    if (startedAt == null) return;

    this.#clearTimer(id);
    const elapsed = Date.now() - startedAt;
    const remainingMs = Math.max(0, item.remainingMs - elapsed);
    this.#timerStartedAt.delete(id);

    this.#updateItem(id, { paused: true, remainingMs });
  }

  resumeTimer(id: string): void {
    const item = this.#findItem(id);
    if (!item || !item.paused || item.dismissing || item.duration <= 0) return;

    this.#updateItem(id, { paused: false });

    const updated = this.#findItem(id);
    if (updated && updated.remainingMs > 0) {
      this.#startTimer(id, updated.remainingMs);
    }
  }

  // ─── Internal ───────────────────────────────────────────

  #startTimer(id: string, durationMs: number): void {
    this.#clearTimer(id);
    this.#timerStartedAt.set(id, Date.now());
    this.#timers.set(
      id,
      setTimeout(() => {
        this.#timers.delete(id);
        this.#timerStartedAt.delete(id);
        this.#beginDismiss(id);
      }, durationMs)
    );
  }

  #clearTimer(id: string): void {
    const timer = this.#timers.get(id);
    if (timer != null) {
      clearTimeout(timer);
      this.#timers.delete(id);
    }
  }

  #beginDismiss(id: string): void {
    this.#clearTimer(id);
    this.#timerStartedAt.delete(id);

    const item = this.#findItem(id);
    if (!item || item.dismissing) return;

    this.#updateItem(id, { dismissing: true, paused: true });

    this.#dismissTimers.set(
      id,
      setTimeout(() => {
        this.#removeItem(id);
        this.#dismissTimers.delete(id);
      }, DISMISS_ANIMATION_MS)
    );
  }

  #removeItem(id: string): void {
    const items = this.#state.items.filter((i) => i.id !== id);
    this.#update({ items });
  }

  #updateItem(id: string, patch: Partial<ToastItem>): void {
    const items = this.#state.items.map((item) => (item.id === id ? { ...item, ...patch } : item));
    this.#update({ items });
  }

  #findItem(id: string): ToastItem | undefined {
    return this.#state.items.find((i) => i.id === id);
  }

  #enforceMaxVisible(): void {
    const active = this.#state.items.filter((i) => !i.dismissing);
    const excess = active.length - this.#state.maxVisible;
    if (excess <= 0) return;

    for (let i = 0; i < excess; i++) {
      this.#beginDismiss(active[i].id);
    }
  }
}
