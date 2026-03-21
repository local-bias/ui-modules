import {
  type AlertIcon,
  type AlertOptions,
  type ConfirmOptions,
  type DialogResult,
  type DialogState,
  type DialogType,
  type QueueItem,
  type TaskItemInput,
  type ShowOptions,
  type StepItem,
  createInitialState,
} from './types';

function normalizeItemInput(input: TaskItemInput): { key: string; label: string } {
  return typeof input === 'string' ? { key: input, label: input } : input;
}

type Listener = (state: DialogState) => void;
type Resolver = (result: DialogResult) => void;

export class DialogController {
  #state: DialogState;
  #listeners = new Set<Listener>();
  #resolver: Resolver | null = null;
  #timerId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.#state = createInitialState();
  }

  // ─── Observable ──────────────────────────────────────────

  get state(): Readonly<DialogState> {
    return this.#state;
  }

  subscribe(fn: Listener): () => void {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #emit(): void {
    const snapshot = { ...this.#state };
    for (const fn of this.#listeners) fn(snapshot);
  }

  #update(patch: Partial<DialogState>): void {
    Object.assign(this.#state, patch);
    this.#emit();
  }

  // ─── Core ────────────────────────────────────────────────

  show(options: ShowOptions = { type: 'loading' }): void {
    this.#clearTimer();
    this.#update({
      open: true,
      dialogType: options.type,
      label: options.label ?? '',
      description: options.description ?? '',
      icon: options.icon ?? null,
      progress: options.progress ?? null,
      allowOutsideClick: options.allowOutsideClick ?? false,
      showConfirmButton: false,
      showCancelButton: false,
    });
  }

  hide(): void {
    this.#clearTimer();
    const wasOpen = this.#state.open;
    this.#update({ ...createInitialState(), open: false });
    if (wasOpen && this.#resolver) {
      this.#resolve({ isConfirmed: false, isCanceled: false, isDismissed: true });
    }
  }

  // ─── Alert ───────────────────────────────────────────────

  alert(optionsOrLabel: string | AlertOptions): Promise<DialogResult> {
    this.#clearTimer();
    const opts: AlertOptions =
      typeof optionsOrLabel === 'string' ? { title: optionsOrLabel } : optionsOrLabel;

    this.#update({
      open: true,
      dialogType: 'alert',
      icon: opts.type ?? 'info',
      title: opts.title ?? '',
      label: '',
      description: opts.description ?? '',
      html: opts.html ?? '',
      showConfirmButton: true,
      showCancelButton: opts.showCancelButton ?? false,
      confirmButtonText: opts.confirmButtonText ?? 'OK',
      cancelButtonText: opts.cancelButtonText ?? 'キャンセル',
      allowOutsideClick: opts.allowOutsideClick ?? true,
      allowEscapeKey: opts.allowEscapeKey ?? true,
      progress: null,
      timer: opts.timer ?? null,
    });

    return this.#createPromise(opts.timer ?? null);
  }

  // ─── Confirm ─────────────────────────────────────────────

  confirm(optionsOrLabel: string | ConfirmOptions): Promise<boolean> {
    this.#clearTimer();
    const opts: ConfirmOptions =
      typeof optionsOrLabel === 'string' ? { title: optionsOrLabel } : optionsOrLabel;

    this.#update({
      open: true,
      dialogType: 'confirm',
      icon: opts.type ?? 'warning',
      title: opts.title ?? '',
      label: '',
      description: opts.description ?? '',
      showConfirmButton: true,
      showCancelButton: true,
      confirmButtonText: opts.confirmButtonText ?? 'OK',
      cancelButtonText: opts.cancelButtonText ?? 'キャンセル',
      allowOutsideClick: opts.allowOutsideClick ?? false,
      allowEscapeKey: opts.allowEscapeKey ?? true,
      progress: null,
      timer: null,
    });

    return this.#createPromise(null).then((r) => r.isConfirmed);
  }

  // ─── Loading helpers ─────────────────────────────────────

  showLoading(label?: string): void {
    this.show({ type: 'loading', label });
  }

  setProgress(percent: number): void {
    this.#update({ progress: percent });
  }

  setLabel(label: string): void {
    this.#update({ label });
  }

  setDescription(description: string): void {
    this.#update({ description });
  }

  // ─── Queue ───────────────────────────────────────────────

  setQueueItems(items: TaskItemInput[]): void {
    this.#update({
      queues: items.map<QueueItem>((i) => ({ ...normalizeItemInput(i), status: 'pending' })),
    });
  }

  showQueue(items: TaskItemInput[], title?: string): void {
    this.setQueueItems(items);
    this.show({ type: 'queue' });
    if (title !== undefined) this.#update({ title });
  }

  setTitle(title: string): void {
    this.#update({ title });
  }

  activateQueue(key: string): void {
    this.#updateItemStatus('queues', key, 'active');
  }

  completeQueue(key: string): void {
    this.#updateItemStatus('queues', key, 'done');
  }

  skipQueue(key: string): void {
    this.#updateItemStatus('queues', key, 'skipped');
  }

  failQueue(key: string): void {
    this.#updateItemStatus('queues', key, 'error');
  }

  clearQueue(): void {
    this.#update({ queues: [] });
  }

  // ─── Steps ───────────────────────────────────────────────

  setStepItems(items: TaskItemInput[]): void {
    this.#update({
      steps: items.map<StepItem>((i) => ({ ...normalizeItemInput(i), status: 'pending' })),
    });
  }

  showSteps(items: TaskItemInput[]): void {
    this.setStepItems(items);
    this.show({ type: 'steps' });
  }

  activateStep(key: string): void {
    this.#updateItemStatus('steps', key, 'active');
  }

  completeStep(key: string): void {
    this.#updateItemStatus('steps', key, 'done');
  }

  skipStep(key: string): void {
    this.#updateItemStatus('steps', key, 'skipped');
  }

  failStep(key: string): void {
    this.#updateItemStatus('steps', key, 'error');
  }

  clearSteps(): void {
    this.#update({ steps: [] });
  }

  // ─── Button actions (called from the component) ──────────

  onConfirm(): void {
    this.#clearTimer();
    const r: DialogResult = { isConfirmed: true, isCanceled: false, isDismissed: false };
    this.#update({ ...createInitialState(), open: false });
    this.#resolve(r);
  }

  onCancel(): void {
    this.#clearTimer();
    const r: DialogResult = { isConfirmed: false, isCanceled: true, isDismissed: false };
    this.#update({ ...createInitialState(), open: false });
    this.#resolve(r);
  }

  onOutsideClick(): void {
    if (!this.#state.allowOutsideClick) return;
    this.onCancel();
  }

  onEscapeKey(): void {
    if (!this.#state.allowEscapeKey) return;
    this.onCancel();
  }

  // ─── Internal ────────────────────────────────────────────

  #createPromise(timer: number | null): Promise<DialogResult> {
    return new Promise<DialogResult>((resolve) => {
      this.#resolver = resolve;
      if (timer != null && timer > 0) {
        this.#timerId = setTimeout(() => {
          this.#update({ ...createInitialState(), open: false });
          resolve({ isConfirmed: false, isCanceled: false, isDismissed: true });
          this.#resolver = null;
        }, timer);
      }
    });
  }

  #resolve(result: DialogResult): void {
    const resolver = this.#resolver;
    this.#resolver = null;
    resolver?.(result);
  }

  #clearTimer(): void {
    if (this.#timerId != null) {
      clearTimeout(this.#timerId);
      this.#timerId = null;
    }
  }

  #updateItemStatus(
    key: 'queues' | 'steps',
    itemKey: string,
    status: QueueItem['status'] | StepItem['status']
  ): void {
    const items = [...this.#state[key]];
    const idx = items.findIndex((i) => i.key === itemKey);
    if (idx >= 0) {
      items[idx] = { ...items[idx], status: status as any };
      this.#update({ [key]: items });
    }
  }
}
