import {
  type AlertIcon,
  type AlertOptions,
  type ConfirmOptions,
  type DialogResult,
  type DialogState,
  type DialogType,
  type FormOptions,
  type QueueItem,
  type TaskItemInput,
  type ShowOptions,
  type StepFormItem,
  type StepFormOptions,
  type StepFormStepInput,
  type StepItem,
  createInitialState,
} from './types';
import { extractFormFields } from './zod-utils';

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
  #formSchema: any = null;
  #formResult: unknown = null;
  #stepFormSchemas: (any | null)[] = [];
  #stepFormResults: Record<string, unknown> = {};

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

  // ─── Form ─────────────────────────────────────────────────

  form<TSchema extends { _output: unknown; safeParse: (data: unknown) => any; _def: any }>(
    schema: TSchema,
    options?: FormOptions<TSchema['_output']>
  ): Promise<TSchema['_output'] | null> {
    this.#clearTimer();
    this.#formSchema = schema;
    this.#formResult = null;

    const fields = extractFormFields(schema as any);

    const defaultValues: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.defaultValue !== undefined) {
        defaultValues[field.key] = field.defaultValue;
      }
    }
    if (options?.defaultValues) {
      Object.assign(defaultValues, options.defaultValues);
    }

    this.#update({
      open: true,
      dialogType: 'form',
      title: options?.title ?? '',
      label: '',
      description: options?.description ?? '',
      icon: null,
      showConfirmButton: true,
      showCancelButton: true,
      confirmButtonText: options?.confirmButtonText ?? 'OK',
      cancelButtonText: options?.cancelButtonText ?? 'キャンセル',
      allowOutsideClick: options?.allowOutsideClick ?? false,
      allowEscapeKey: options?.allowEscapeKey ?? true,
      progress: null,
      timer: null,
      formFields: fields,
      formValues: defaultValues,
      formErrors: {},
      formTouched: {},
      formLayout: options?.layout ?? {},
      formValidateOnChange: options?.validateOnChange ?? true,
      formValidateOnBlur: options?.validateOnBlur ?? true,
    });

    return this.#createPromise(null).then((r) => {
      const data = this.#formResult;
      this.#formSchema = null;
      this.#formResult = null;
      return r.isConfirmed ? (data as TSchema['_output']) : null;
    });
  }

  updateFormField(key: string, value: unknown): void {
    const formValues = { ...this.#state.formValues, [key]: value };
    const formTouched = { ...this.#state.formTouched, [key]: true };
    let formErrors = { ...this.#state.formErrors };

    if (this.#formSchema && this.#state.formValidateOnChange) {
      formErrors = this.#validateFormField(key, formValues, formErrors);
    }

    this.#update({ formValues, formTouched, formErrors });
  }

  touchFormField(key: string): void {
    const formTouched = { ...this.#state.formTouched, [key]: true };
    let formErrors = { ...this.#state.formErrors };

    if (this.#formSchema && this.#state.formValidateOnBlur) {
      formErrors = this.#validateFormField(key, this.#state.formValues, formErrors);
    }

    this.#update({ formTouched, formErrors });
  }

  #validateFormField(
    key: string,
    values: Record<string, unknown>,
    errors: Record<string, string>
  ): Record<string, string> {
    const result = this.#formSchema.safeParse(values);
    const updated = { ...errors };
    if (result.success) {
      delete updated[key];
    } else {
      const fieldIssue = result.error.issues.find(
        (issue: { path: (string | number)[] }) => issue.path[0]?.toString() === key
      );
      if (fieldIssue) {
        updated[key] = fieldIssue.message;
      } else {
        delete updated[key];
      }
    }
    return updated;
  }

  // ─── Step Form ───────────────────────────────────────────

  showStepForm(
    steps: StepFormStepInput[],
    options?: StepFormOptions
  ): Promise<Record<string, unknown> | null> {
    this.#clearTimer();
    this.#stepFormSchemas = steps.map((s) => s.schema ?? null);
    this.#stepFormResults = {};

    const stepFormSteps: StepFormItem[] = steps.map((s) => {
      const fields = s.schema ? extractFormFields(s.schema as any) : [];
      const values: Record<string, unknown> = {};
      for (const f of fields) {
        if (f.defaultValue !== undefined) values[f.key] = f.defaultValue;
      }
      if (s.defaultValues) Object.assign(values, s.defaultValues);
      return {
        key: s.key,
        label: s.label,
        description: s.description ?? '',
        fields,
        values,
        errors: {},
        touched: {},
        layout: s.layout ?? {},
      };
    });

    this.#update({
      open: true,
      dialogType: 'step-form',
      title: options?.title ?? '',
      label: '',
      description: '',
      icon: null,
      showConfirmButton: false,
      showCancelButton: false,
      allowOutsideClick: options?.allowOutsideClick ?? false,
      allowEscapeKey: options?.allowEscapeKey ?? true,
      progress: null,
      timer: null,
      stepFormSteps,
      stepFormCurrentIndex: 0,
      stepFormNextText: options?.nextButtonText ?? '次へ',
      stepFormPrevText: options?.prevButtonText ?? '戻る',
      stepFormSubmitText: options?.submitButtonText ?? 'OK',
      cancelButtonText: options?.cancelButtonText ?? 'キャンセル',
    });

    return this.#createPromise(null).then((r) => {
      const data = this.#stepFormResults;
      this.#stepFormSchemas = [];
      this.#stepFormResults = {};
      return r.isConfirmed ? data : null;
    });
  }

  onStepNext(): void {
    const s = this.#state;
    const idx = s.stepFormCurrentIndex;
    const step = s.stepFormSteps[idx];
    if (!step) return;

    const schema = this.#stepFormSchemas[idx];

    if (schema) {
      const result = schema.safeParse(step.values);
      if (!result.success) {
        const errors: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const key = issue.path[0]?.toString();
          if (key && !errors[key]) errors[key] = issue.message;
        }
        const touched: Record<string, boolean> = {};
        for (const f of step.fields) touched[f.key] = true;
        this.#updateCurrentStep({ errors, touched });
        return;
      }
      this.#stepFormResults[step.key] = result.data;
    }

    const isLast = idx === s.stepFormSteps.length - 1;
    if (isLast) {
      const r: DialogResult = { isConfirmed: true, isCanceled: false, isDismissed: false };
      this.#update({ ...createInitialState(), open: false });
      this.#resolve(r);
      return;
    }

    this.#update({ stepFormCurrentIndex: idx + 1 });
  }

  onStepPrev(): void {
    const idx = this.#state.stepFormCurrentIndex;
    if (idx <= 0) return;
    this.#update({ stepFormCurrentIndex: idx - 1 });
  }

  updateStepFormField(fieldKey: string, value: unknown): void {
    const s = this.#state;
    const idx = s.stepFormCurrentIndex;
    const step = s.stepFormSteps[idx];
    if (!step) return;

    const values = { ...step.values, [fieldKey]: value };
    const touched = { ...step.touched, [fieldKey]: true };
    let errors = { ...step.errors };

    const schema = this.#stepFormSchemas[idx];
    if (schema && s.formValidateOnChange) {
      errors = this.#validateStepField(schema, fieldKey, values, errors);
    }

    this.#updateCurrentStep({ values, touched, errors });
  }

  touchStepFormField(fieldKey: string): void {
    const s = this.#state;
    const idx = s.stepFormCurrentIndex;
    const step = s.stepFormSteps[idx];
    if (!step) return;

    const touched = { ...step.touched, [fieldKey]: true };
    let errors = { ...step.errors };

    const schema = this.#stepFormSchemas[idx];
    if (schema && s.formValidateOnBlur) {
      errors = this.#validateStepField(schema, fieldKey, step.values, errors);
    }

    this.#updateCurrentStep({ touched, errors });
  }

  #updateCurrentStep(patch: Partial<StepFormItem>): void {
    const idx = this.#state.stepFormCurrentIndex;
    const stepFormSteps = this.#state.stepFormSteps.map((st, i) =>
      i === idx ? { ...st, ...patch } : st
    );
    this.#update({ stepFormSteps });
  }

  #validateStepField(
    schema: any,
    fieldKey: string,
    values: Record<string, unknown>,
    errors: Record<string, string>
  ): Record<string, string> {
    const result = schema.safeParse(values);
    const updated = { ...errors };
    if (result.success) {
      delete updated[fieldKey];
    } else {
      const issue = result.error.issues.find(
        (iss: { path: (string | number)[] }) => iss.path[0]?.toString() === fieldKey
      );
      if (issue) {
        updated[fieldKey] = issue.message;
      } else {
        delete updated[fieldKey];
      }
    }
    return updated;
  }

  // ─── Button actions (called from the component) ──────────

  onConfirm(): void {
    this.#clearTimer();

    if (this.#state.dialogType === 'form' && this.#formSchema) {
      const result = this.#formSchema.safeParse(this.#state.formValues);
      if (!result.success) {
        const formErrors: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const key = issue.path[0]?.toString();
          if (key && !formErrors[key]) {
            formErrors[key] = issue.message;
          }
        }
        const formTouched: Record<string, boolean> = {};
        for (const field of this.#state.formFields) {
          formTouched[field.key] = true;
        }
        this.#update({ formErrors, formTouched });
        return;
      }
      this.#formResult = result.data;
    }

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
