import { DialogController } from './controller';
import type {
  AlertOptions,
  ConfirmOptions,
  DialogResult,
  FormOptions,
  StepFormOptions,
  StepFormStepInput,
  TaskItemInput,
  ShowOptions,
} from './types';
import './overlay-dialog';
import type { OverlayDialog } from './overlay-dialog';

class DialogSingleton {
  readonly #controller = new DialogController();
  #element: OverlayDialog | null = null;

  #ensureElement(): void {
    if (this.#element) return;
    if (typeof document === 'undefined') return;

    const el = document.createElement('overlay-dialog') as OverlayDialog;
    el.controller = this.#controller;
    document.body.appendChild(el);
    this.#element = el;
  }

  // ─── Core ────────────────────────────────────────────────

  show(options?: ShowOptions): void {
    this.#ensureElement();
    this.#controller.show(options);
  }

  hide(): void {
    this.#controller.hide();
  }

  // ─── Alert / Confirm ─────────────────────────────────────

  alert(optionsOrLabel: string | AlertOptions): Promise<DialogResult> {
    this.#ensureElement();
    return this.#controller.alert(optionsOrLabel);
  }

  confirm(optionsOrLabel: string | ConfirmOptions): Promise<boolean> {
    this.#ensureElement();
    return this.#controller.confirm(optionsOrLabel);
  }

  // ─── Form ──────────────────────────────────────────────────

  form<TSchema extends { _output: unknown; safeParse: (data: unknown) => any; _def: any }>(
    schema: TSchema,
    options?: FormOptions<TSchema['_output']>
  ): Promise<TSchema['_output'] | null> {
    this.#ensureElement();
    return this.#controller.form(schema, options);
  }

  // ─── Step Form ─────────────────────────────────────────────

  showStepForm(
    steps: StepFormStepInput[],
    options?: StepFormOptions
  ): Promise<Record<string, unknown> | null> {
    this.#ensureElement();
    return this.#controller.showStepForm(steps, options);
  }

  onStepNext(): void {
    this.#controller.onStepNext();
  }

  onStepPrev(): void {
    this.#controller.onStepPrev();
  }

  updateStepFormField(fieldKey: string, value: unknown): void {
    this.#controller.updateStepFormField(fieldKey, value);
  }

  touchStepFormField(fieldKey: string): void {
    this.#controller.touchStepFormField(fieldKey);
  }

  // ─── Loading helpers ─────────────────────────────────────

  showLoading(label?: string): void {
    this.#ensureElement();
    this.#controller.showLoading(label);
  }

  setProgress(percent: number): void {
    this.#controller.setProgress(percent);
  }

  setLabel(label: string): void {
    this.#controller.setLabel(label);
  }

  setDescription(description: string): void {
    this.#controller.setDescription(description);
  }

  // ─── Queue ───────────────────────────────────────────────

  setQueueItems(items: TaskItemInput[]): void {
    this.#controller.setQueueItems(items);
  }

  showQueue(items: TaskItemInput[], title?: string): void {
    this.#ensureElement();
    this.#controller.showQueue(items, title);
  }

  activateQueue(key: string): void {
    this.#controller.activateQueue(key);
  }

  completeQueue(key: string): void {
    this.#controller.completeQueue(key);
  }

  skipQueue(key: string): void {
    this.#controller.skipQueue(key);
  }

  failQueue(key: string): void {
    this.#controller.failQueue(key);
  }

  setTitle(title: string): void {
    this.#controller.setTitle(title);
  }

  clearQueue(): void {
    this.#controller.clearQueue();
  }

  // ─── Steps ───────────────────────────────────────────────

  setStepItems(items: TaskItemInput[]): void {
    this.#controller.setStepItems(items);
  }

  showSteps(items: TaskItemInput[]): void {
    this.#ensureElement();
    this.#controller.showSteps(items);
  }

  activateStep(key: string): void {
    this.#controller.activateStep(key);
  }

  completeStep(key: string): void {
    this.#controller.completeStep(key);
  }

  skipStep(key: string): void {
    this.#controller.skipStep(key);
  }

  failStep(key: string): void {
    this.#controller.failStep(key);
  }

  clearSteps(): void {
    this.#controller.clearSteps();
  }

  // ─── Advanced ────────────────────────────────────────────

  get controller(): DialogController {
    return this.#controller;
  }
}

export const dialog = new DialogSingleton();
