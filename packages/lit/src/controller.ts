import {
  type AlertIcon,
  type AlertOptions,
  type ConfirmOptions,
  type DialogConfig,
  type DialogResult,
  type DialogState,
  type DialogTexts,
  type DialogType,
  type DialogWidth,
  type FormFieldMeta,
  type FormLayout,
  type FormOptions,
  type QueueItem,
  type TaskItemInput,
  type ShowOptions,
  type StepFormOptions,
  type StepFormStepInput,
  type StepItem,
  type StepsOptions,
  createInitialState,
  DEFAULT_DIALOG_TEXTS,
} from './types';
import { nextStepIndex, prevStepIndex } from './step-utils';
import { resolveDialogWidth } from './width-utils';
import { extractFormFields } from './zod-utils';

function normalizeItemInput(input: TaskItemInput): { key: string; label: string } {
  return typeof input === 'string' ? { key: input, label: input } : input;
}

/**
 * key はステータス更新の宛先。重複すると `findIndex` が常に先頭を指すので、
 * 2件目以降は永久に pending のまま取り残される (進捗カウンタも埋まらない)。
 * 文字列指定は key と label が同じ値になるため、同じラベルを並べると簡単に踏む。
 */
function warnDuplicateKeys(kind: 'queue' | 'step', items: { key: string }[]): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const { key } of items) {
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  if (duplicates.size === 0) return;
  const keys = [...duplicates].map((k) => JSON.stringify(k)).join(', ');
  console.warn(
    `[@konomi-app/ui] Duplicate ${kind} key(s): ${keys} — status updates only ever reach ` +
      'the first match, so later items with the same key stay stuck. ' +
      'Pass { key, label } objects with unique keys instead.'
  );
}

/** 宛先のない更新は黙って捨てず知らせる — 大半は key の打ち間違い。 */
function warnUnknownKey(kind: 'queue' | 'step', key: string): void {
  console.warn(
    `[@konomi-app/ui] No ${kind} item with key ${JSON.stringify(key)} — the call was ignored.`
  );
}

type Listener = (state: DialogState) => void;
type Resolver = (result: DialogResult) => void;

/**
 * ウィザードの1ステップぶんのフォーム定義と入力値。
 *
 * ステップの *表示* 状態 (ラベル/status) は `state.steps` が唯一の持ち主で、
 * ここには持たない。現在ステップの入力値は `#syncWizardBody()` が
 * `state.form*` に射影し、描画層は通常のフォームと同じ経路で読む。
 */
interface WizardStep {
  key: string;
  description: string;
  schema: any | null;
  fields: FormFieldMeta[];
  layout: FormLayout;
  values: Record<string, unknown>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  /** このステップ固有の幅。null ならセッションの幅にフォールバックする。 */
  width: string | null;
}

interface WizardSession {
  steps: WizardStep[];
  results: Record<string, unknown>;
  /** ステップが自前の幅を持たないときの既定 (= showStepForm() の width)。 */
  width: string | null;
}

export class DialogController {
  #state: DialogState;
  #listeners = new Set<Listener>();
  #resolver: Resolver | null = null;
  #timerId: ReturnType<typeof setTimeout> | null = null;
  #formSchema: any = null;
  #formResult: unknown = null;
  // Unique per form() call — identifies which call's .then() may clear #formSchema/#formResult.
  // Cannot use #formSchema itself for this since callers commonly reuse the same schema
  // reference across multiple form() calls.
  #formSession: object | null = null;
  /** 実行中のウィザード。null なら `steps` は素の常駐クロームとして扱う。 */
  #wizard: WizardSession | null = null;
  /** 送信時に確定したウィザードの入力値 (Promise の then で読むため保持する)。 */
  #wizardResults: Record<string, unknown> = {};
  // #formSession と同じ役割 — どの showStepForm() 呼び出しの then が後始末してよいかを識別する。
  #wizardSession: object | null = null;
  #sanitizeHtml: ((html: string) => string) | null = null;
  #texts: Required<DialogTexts> = { ...DEFAULT_DIALOG_TEXTS };

  constructor() {
    this.#state = createInitialState();
  }

  // ─── Configuration ───────────────────────────────────────

  configure(config: DialogConfig): void {
    if (config.sanitizeHtml !== undefined) this.#sanitizeHtml = config.sanitizeHtml;
    if (config.texts) this.#texts = { ...this.#texts, ...config.texts };
  }

  /** Current effective default texts (built-ins merged with any `configure({ texts })` override). */
  get texts(): Readonly<Required<DialogTexts>> {
    return this.#texts;
  }

  #applySanitize(html: string): string {
    return this.#sanitizeHtml ? this.#sanitizeHtml(html) : html;
  }

  // ─── Observable ──────────────────────────────────────────

  get state(): Readonly<DialogState> {
    return this.#state;
  }

  subscribe(fn: Listener): () => void {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  /**
   * 増やすのは #emit だけ。リスナーの中から #update() が呼ばれた (再入した) ことを
   * 外側のループが検出するための世代番号。
   */
  #emitVersion = 0;

  #emit(): void {
    const version = ++this.#emitVersion;
    const snapshot = { ...this.#state };
    for (const fn of this.#listeners) {
      fn(snapshot);
      // リスナーが同期的に状態を進めた場合、入れ子の #emit が全リスナーに
      // 新しいスナップショットを配り終えている。ここで続けると、残りのリスナーに
      // 古い状態を後から被せてしまう (閉→開の再入で「開いているのに未ロック」に
      // なるなど) ので打ち切る。
      if (this.#emitVersion !== version) return;
    }
  }

  #update(patch: Partial<DialogState>): void {
    Object.assign(this.#state, patch);
    this.#emit();
  }

  // ─── Core ────────────────────────────────────────────────

  /**
   * 本文を差し替える。`steps` クロームと `queues` は意図的に温存されるので、
   * ステップ進行中に本文だけを loading → queue → form と差し替えられる。
   */
  show(options: ShowOptions = { type: 'loading' }): void {
    this.#settlePending();
    this.#update({
      open: true,
      dialogType: options.type,
      // `title` isn't a ShowOptions field (queue/steps titles go through setTitle()/
      // showQueue()'s dedicated param) — always reset it so a title left over from a
      // previous alert()/confirm()/showQueue() call can't leak into this dialog's
      // accessible name.
      title: '',
      label: options.label ?? '',
      description: options.description ?? '',
      html: this.#applySanitize(options.html ?? ''),
      icon: options.icon ?? null,
      progress: options.progress ?? null,
      allowOutsideClick: options.allowOutsideClick ?? false,
      allowEscapeKey: options.allowEscapeKey ?? false,
      width: resolveDialogWidth(options.width),
      showConfirmButton: false,
      showCancelButton: false,
    });
  }

  hide(): void {
    this.#settlePending();
    this.#update({ ...createInitialState(), open: false });
  }

  // ─── Alert ───────────────────────────────────────────────

  alert(optionsOrLabel: string | AlertOptions): Promise<DialogResult> {
    this.#settlePending();
    const opts: AlertOptions =
      typeof optionsOrLabel === 'string' ? { title: optionsOrLabel } : optionsOrLabel;

    this.#update({
      open: true,
      dialogType: 'alert',
      icon: opts.type ?? 'info',
      title: opts.title ?? '',
      label: '',
      description: opts.description ?? '',
      html: this.#applySanitize(opts.html ?? ''),
      showConfirmButton: true,
      showCancelButton: opts.showCancelButton ?? false,
      confirmButtonText: opts.confirmButtonText ?? this.#texts.confirmButtonText,
      cancelButtonText: opts.cancelButtonText ?? this.#texts.cancelButtonText,
      allowOutsideClick: opts.allowOutsideClick ?? true,
      allowEscapeKey: opts.allowEscapeKey ?? true,
      width: resolveDialogWidth(opts.width),
      progress: null,
      timer: opts.timer ?? null,
    });

    return this.#createPromise(opts.timer ?? null);
  }

  // ─── Confirm ─────────────────────────────────────────────

  confirm(optionsOrLabel: string | ConfirmOptions): Promise<boolean> {
    this.#settlePending();
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
      confirmButtonText: opts.confirmButtonText ?? this.#texts.confirmButtonText,
      cancelButtonText: opts.cancelButtonText ?? this.#texts.cancelButtonText,
      allowOutsideClick: opts.allowOutsideClick ?? false,
      allowEscapeKey: opts.allowEscapeKey ?? true,
      width: resolveDialogWidth(opts.width),
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

  setHtml(html: string): void {
    this.#update({ html: this.#applySanitize(html) });
  }

  /**
   * 開いたままダイアログの幅を変える。`null` を渡すと `dialogType` の既定幅に戻る。
   * ここで指定した幅は「今の本文」のもので、次に本文を出す API
   * (`show()` / `alert()` / `form()` など) が呼ばれると上書きされる。
   */
  setWidth(width: DialogWidth | null): void {
    this.#update({ width: resolveDialogWidth(width) });
  }

  // ─── Queue ───────────────────────────────────────────────

  setQueueItems(items: TaskItemInput[]): void {
    const queues = items.map<QueueItem>((i) => ({ ...normalizeItemInput(i), status: 'pending' }));
    warnDuplicateKeys('queue', queues);
    this.#update({ queues });
  }

  showQueue(items: TaskItemInput[], title?: string): void {
    this.setQueueItems(items);
    this.show({ type: 'queue' });
    if (title !== undefined) this.#update({ title });
  }

  setTitle(title: string): void {
    this.#update({ title });
  }

  /**
   * キュー項目を実行中にする。
   *
   * `activateStep()` と違い active を1つに絞らない — キューは並列実行を想定していて、
   * 複数の項目が同時に走ることを許す。「どこまで進んだか」は描画側が
   * 完了 → 実行中 → 待機 の順に並べ替えて示すので、active が複数あっても読み取れる。
   */
  activateQueue(key: string): void {
    this.#setQueueStatus(key, 'active');
  }

  completeQueue(key: string): void {
    this.#setQueueStatus(key, 'done');
  }

  skipQueue(key: string): void {
    this.#setQueueStatus(key, 'skipped');
  }

  failQueue(key: string): void {
    this.#setQueueStatus(key, 'error');
  }

  clearQueue(): void {
    this.#update({ queues: [] });
  }

  // ─── Steps (常駐クローム) ─────────────────────────────────
  //
  // steps は本文の一種ではなく、ダイアログ上部に常駐するインジケータ。
  // 一度セットしたら clearSteps() / hide() が呼ばれるまで、本文が
  // loading/queue/alert/confirm/form のどれに差し替わっても表示され続ける。

  /** ステップを差し替える。ダイアログの開閉には影響しない。 */
  setStepItems(items: TaskItemInput[]): void {
    const steps = items.map<StepItem>((i) => ({ ...normalizeItemInput(i), status: 'pending' }));
    warnDuplicateKeys('step', steps);
    this.#update({ steps, stepIndex: -1 });
  }

  /**
   * ステップクロームを表示してダイアログを開く。本文は既定でローディング。
   * 開いたあとは `show()` / `showQueue()` / `form()` などで本文だけを自由に
   * 差し替えられ、その間もクロームは残り続ける。
   */
  showSteps(items: TaskItemInput[], options: StepsOptions = {}): void {
    // show() が先。#settlePending() が走るより後に steps をセットしないと、
    // 直前のウィザードの後始末で今セットしたクロームまで消えてしまう。
    this.show({
      type: 'loading',
      label: options.label,
      description: options.description,
      allowOutsideClick: options.allowOutsideClick,
      allowEscapeKey: options.allowEscapeKey,
      width: options.width,
    });
    this.setStepItems(items);
    if (options.title !== undefined) this.setTitle(options.title);
  }

  /**
   * 現在位置を `key` のステップへ移す。位置を動かす唯一の API で、
   * 併せて他に `active` なステップがあれば `pending` に戻す (active は常に1つ)。
   */
  activateStep(key: string): void {
    const idx = this.#state.steps.findIndex((s) => s.key === key);
    if (idx < 0) {
      warnUnknownKey('step', key);
      return;
    }
    const steps = this.#state.steps.map<StepItem>((s, i) => {
      if (i === idx) return { ...s, status: 'active' };
      return s.status === 'active' ? { ...s, status: 'pending' } : s;
    });
    this.#update({ steps, stepIndex: idx });
    this.#syncWizardBody();
  }

  /** ステップを完了にする。現在位置は動かさない。 */
  completeStep(key: string): void {
    this.#setStepStatus(key, 'done');
  }

  /**
   * ステップをスキップ扱いにする。現在位置は動かさない。
   * ウィザード実行中は、以降の `次へ` / `戻る` がこのステップを飛び越える。
   */
  skipStep(key: string): void {
    this.#setStepStatus(key, 'skipped');
  }

  /**
   * ステップを失敗扱いにする。現在位置は動かさないので、ウィザード実行中に
   * 呼んでもそのステップに留まったままインジケータだけが赤くなる。
   */
  failStep(key: string): void {
    this.#setStepStatus(key, 'error');
  }

  /** クロームを破棄する。ダイアログ自体は閉じない (閉じるなら `hide()`)。 */
  clearSteps(): void {
    this.#wizard = null;
    this.#update({ steps: [], stepIndex: -1 });
  }

  #setStepStatus(key: string, status: StepItem['status']): void {
    const idx = this.#state.steps.findIndex((s) => s.key === key);
    if (idx < 0) {
      warnUnknownKey('step', key);
      return;
    }
    const steps = this.#state.steps.map<StepItem>((s, i) =>
      i === idx ? { ...s, status } : s
    );
    this.#update({ steps });
  }

  // ─── Form ─────────────────────────────────────────────────

  form<TSchema extends { _output: unknown; safeParse: (data: unknown) => any; _def: any }>(
    schema: TSchema,
    options?: FormOptions<TSchema['_output']>
  ): Promise<TSchema['_output'] | null> {
    this.#settlePending();
    const session = {};
    this.#formSession = session;
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
      confirmButtonText: options?.confirmButtonText ?? this.#texts.confirmButtonText,
      cancelButtonText: options?.cancelButtonText ?? this.#texts.cancelButtonText,
      allowOutsideClick: options?.allowOutsideClick ?? false,
      allowEscapeKey: options?.allowEscapeKey ?? true,
      width: resolveDialogWidth(options?.width),
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
      // Only clear if a newer form() session hasn't already replaced these fields
      // (settlePending() resolves this promise immediately when a newer session starts).
      // Uses a dedicated session token rather than `schema` itself, since callers commonly
      // reuse the same schema reference across multiple form() calls.
      if (this.#formSession === session) {
        this.#formSchema = null;
        this.#formResult = null;
        this.#formSession = null;
      }
      return r.isConfirmed ? (data as TSchema['_output']) : null;
    });
  }

  /**
   * フォーム入力の更新。単発フォームでもウィザードの現在ステップでも同じ経路を通る
   * (ウィザード中は書き込み先がステップ側のストアになるだけ)。
   */
  updateFormField(key: string, value: unknown): void {
    const step = this.#currentWizardStep();
    if (step) {
      const values = { ...step.values, [key]: value };
      const touched = { ...step.touched, [key]: true };
      const errors =
        step.schema && this.#state.formValidateOnChange
          ? this.#validateField(step.schema, key, values, step.errors)
          : { ...step.errors };
      this.#patchWizardStep({ values, touched, errors });
      return;
    }

    const formValues = { ...this.#state.formValues, [key]: value };
    const formTouched = { ...this.#state.formTouched, [key]: true };
    const formErrors =
      this.#formSchema && this.#state.formValidateOnChange
        ? this.#validateField(this.#formSchema, key, formValues, this.#state.formErrors)
        : { ...this.#state.formErrors };

    this.#update({ formValues, formTouched, formErrors });
  }

  touchFormField(key: string): void {
    const step = this.#currentWizardStep();
    if (step) {
      const touched = { ...step.touched, [key]: true };
      const errors =
        step.schema && this.#state.formValidateOnBlur
          ? this.#validateField(step.schema, key, step.values, step.errors)
          : { ...step.errors };
      this.#patchWizardStep({ touched, errors });
      return;
    }

    const formTouched = { ...this.#state.formTouched, [key]: true };
    const formErrors =
      this.#formSchema && this.#state.formValidateOnBlur
        ? this.#validateField(this.#formSchema, key, this.#state.formValues, this.#state.formErrors)
        : { ...this.#state.formErrors };

    this.#update({ formTouched, formErrors });
  }

  /** スキーマ全体を検証し、`key` のフィールドに対応するエラーだけを差し替える。 */
  #validateField(
    schema: any,
    key: string,
    values: Record<string, unknown>,
    errors: Record<string, string>
  ): Record<string, string> {
    const result = schema.safeParse(values);
    const updated = { ...errors };
    if (result.success) {
      delete updated[key];
      return updated;
    }
    const fieldIssue = result.error.issues.find(
      (issue: { path: (string | number)[] }) => issue.path[0]?.toString() === key
    );
    if (fieldIssue) {
      updated[key] = fieldIssue.message;
    } else {
      delete updated[key];
    }
    return updated;
  }

  // ─── Step Form (steps クローム + form 本文 + ナビゲーション) ──
  //
  // ウィザードは独自のステップ状態を持たない。表示は素の steps クロームを
  // そのまま使い、`activateStep()` を現在位置の移動手段として共有する。
  // そのため skipStep() / failStep() がウィザード中でもそのまま効く。

  showStepForm(
    steps: StepFormStepInput[],
    options?: StepFormOptions
  ): Promise<Record<string, unknown> | null> {
    this.#settlePending();
    const session = {};
    this.#wizardSession = session;
    this.#wizardResults = {};
    // 一度だけ解決する — 不正値の警告が二重に出ないように。
    const sessionWidth = resolveDialogWidth(options?.width);

    const wizardSteps: WizardStep[] = steps.map((s) => {
      const fields = s.schema ? extractFormFields(s.schema as any) : [];
      const values: Record<string, unknown> = {};
      for (const f of fields) {
        if (f.defaultValue !== undefined) values[f.key] = f.defaultValue;
      }
      if (s.defaultValues) Object.assign(values, s.defaultValues);
      return {
        key: s.key,
        description: s.description ?? '',
        schema: s.schema ?? null,
        fields,
        layout: s.layout ?? {},
        values,
        errors: {},
        touched: {},
        width: resolveDialogWidth(s.width),
      };
    });
    this.#wizard = {
      steps: wizardSteps,
      results: {},
      width: sessionWidth,
    };

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
      width: sessionWidth,
      progress: null,
      timer: null,
      steps: steps.map<StepItem>((s) => ({ key: s.key, label: s.label, status: 'pending' })),
      stepIndex: -1,
      stepFormNextText: options?.nextButtonText ?? this.#texts.stepFormNextText,
      stepFormPrevText: options?.prevButtonText ?? this.#texts.stepFormPrevText,
      stepFormSubmitText: options?.submitButtonText ?? this.#texts.stepFormSubmitText,
      cancelButtonText: options?.cancelButtonText ?? this.#texts.cancelButtonText,
    });

    const first = steps[0];
    if (first) this.activateStep(first.key);

    return this.#createPromise(null).then((r) => {
      const data = this.#wizardResults;
      // Only clear if a newer showStepForm() session hasn't already replaced these fields
      // (settlePending() resolves this promise immediately when a newer session starts).
      if (this.#wizardSession === session) {
        this.#wizardResults = {};
        this.#wizardSession = null;
      }
      return r.isConfirmed ? data : null;
    });
  }

  /** 現在ステップを検証し、通れば完了にして次へ。次が無ければ送信して終了する。 */
  onStepNext(): void {
    const wizard = this.#wizard;
    const step = this.#currentWizardStep();
    if (!wizard || !step) return;

    // skipStep() 済みのステップは検証も結果収集も完了マークもせず素通りさせる。
    // 'error' は復帰しうるので、検証が通れば 'done' に上書きする。
    const current = this.#state.steps[this.#state.stepIndex];
    const isSkipped = current?.status === 'skipped';

    if (!isSkipped && step.schema) {
      const result = step.schema.safeParse(step.values);
      if (!result.success) {
        const errors: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const key = issue.path[0]?.toString();
          if (key && !errors[key]) errors[key] = issue.message;
        }
        const touched: Record<string, boolean> = {};
        for (const f of step.fields) touched[f.key] = true;
        this.#patchWizardStep({ errors, touched });
        return;
      }
      this.#wizard = { ...wizard, results: { ...wizard.results, [step.key]: result.data } };
    }

    if (!isSkipped && current) this.completeStep(current.key);

    const next = nextStepIndex(this.#state.steps, this.#state.stepIndex);
    if (next < 0) {
      this.#submitWizard();
      return;
    }
    this.activateStep(this.#state.steps[next].key);
  }

  /** 前のステップへ戻る (検証なし)。現在ステップは `pending` に戻る。 */
  onStepPrev(): void {
    const prev = prevStepIndex(this.#state.steps, this.#state.stepIndex);
    if (prev < 0) return;
    this.activateStep(this.#state.steps[prev].key);
  }

  #currentWizardStep(): WizardStep | null {
    const wizard = this.#wizard;
    if (!wizard) return null;
    const key = this.#state.steps[this.#state.stepIndex]?.key;
    if (key === undefined) return null;
    return wizard.steps.find((s) => s.key === key) ?? null;
  }

  #patchWizardStep(patch: Partial<WizardStep>): void {
    const wizard = this.#wizard;
    const current = this.#currentWizardStep();
    if (!wizard || !current) return;
    this.#wizard = {
      ...wizard,
      steps: wizard.steps.map((s) => (s.key === current.key ? { ...s, ...patch } : s)),
    };
    this.#syncWizardBody();
  }

  /**
   * 現在ステップのフォーム定義・入力値を `state.form*` に射影する。
   * ウィザードのフォームを通常のフォームと同じ描画・更新経路に載せるための唯一の橋渡し。
   */
  #syncWizardBody(): void {
    if (this.#state.dialogType !== 'step-form') return;
    const step = this.#currentWizardStep();
    if (!step) return;
    this.#update({
      description: step.description,
      // 幅はステップに追従する。ウィザード中は setWidth() より step.width が優先。
      width: step.width ?? this.#wizard?.width ?? null,
      formFields: step.fields,
      formValues: step.values,
      formErrors: step.errors,
      formTouched: step.touched,
      formLayout: step.layout,
    });
  }

  /** ウィザードは自分が出したクロームごと後始末してダイアログを閉じる。 */
  #submitWizard(): void {
    this.#wizardResults = this.#wizard?.results ?? {};
    this.#wizard = null;
    const r: DialogResult = { isConfirmed: true, isCanceled: false, isDismissed: false };
    this.#update({ ...createInitialState(), open: false });
    this.#resolve(r);
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
    this.#closeCurrentBody();
    this.#resolve(r);
  }

  onCancel(): void {
    this.#clearTimer();
    const r: DialogResult = { isConfirmed: false, isCanceled: true, isDismissed: false };
    this.#closeCurrentBody();
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

  /**
   * 本文を畳む。steps クロームが有効な間はダイアログを閉じきらず、中立の
   * ローディング本文に戻すだけにする — クロームの寿命は clearSteps()/hide() が
   * 握っていて、その内側で開かれた alert/confirm/form の決着で消えてはならない。
   * ウィザード本体の終了 (キャンセル) は例外で、自分のクロームごと畳む。
   */
  #closeCurrentBody(): void {
    const { steps, stepIndex, queues } = this.#state;
    if (!this.#wizard && steps.length > 0) {
      this.#update({
        ...createInitialState(),
        open: true,
        dialogType: 'loading',
        steps,
        stepIndex,
        // キュー項目も温存する — 進捗を保ったまま show({ type: 'queue' }) で
        // 本文を戻せるようにするため。破棄は clearQueue() / hide() の担当。
        queues,
      });
      return;
    }
    this.#wizard = null;
    this.#update({ ...createInitialState(), open: false });
  }

  /**
   * Resolves any dialog promise still pending from a previous show/alert/confirm/form/
   * showStepForm call as dismissed, so callers awaiting it never hang when a new dialog
   * session takes over before the old one settled.
   */
  #settlePending(): void {
    this.#clearTimer();
    if (this.#wizard) {
      // ウィザードが割り込まれた場合、ウィザードが出していたクロームも道連れにする
      // (素の showSteps() 由来のクロームは、新しい本文をまたいでも残す)。
      this.#wizard = null;
      Object.assign(this.#state, { steps: [], stepIndex: -1 });
    }
    if (this.#resolver) {
      this.#resolve({ isConfirmed: false, isCanceled: false, isDismissed: true });
    }
  }

  #createPromise(timer: number | null): Promise<DialogResult> {
    return new Promise<DialogResult>((resolve) => {
      this.#resolver = resolve;
      if (timer != null && timer > 0) {
        this.#timerId = setTimeout(() => {
          this.#timerId = null;
          this.#closeCurrentBody();
          this.#resolve({ isConfirmed: false, isCanceled: false, isDismissed: true });
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

  #setQueueStatus(itemKey: string, status: QueueItem['status']): void {
    const idx = this.#state.queues.findIndex((i) => i.key === itemKey);
    if (idx < 0) {
      warnUnknownKey('queue', itemKey);
      return;
    }
    const queues = this.#state.queues.map<QueueItem>((item, i) =>
      i === idx ? { ...item, status } : item
    );
    this.#update({ queues });
  }
}
