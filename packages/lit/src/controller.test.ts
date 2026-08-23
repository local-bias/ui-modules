import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { DialogController } from './controller';
import { stepStatuses } from './test-utils';

let dialog: DialogController;

beforeEach(() => {
  dialog = new DialogController();
});

// ═══════════════════════════════════════════════════════════════
// Steps — 常駐クローム
// ═══════════════════════════════════════════════════════════════

describe('steps chrome', () => {
  it('opens with a loading body and no current position', () => {
    dialog.showSteps(['取得', '処理']);

    expect(dialog.state.open).toBe(true);
    expect(dialog.state.dialogType).toBe('loading');
    expect(stepStatuses(dialog.state.steps)).toBe('取得:pending 処理:pending');
    expect(dialog.state.stepIndex).toBe(-1);
  });

  it('accepts explicit key/label pairs as well as bare strings', () => {
    dialog.showSteps([
      { key: 'a', label: '取得' },
      { key: 'b', label: '処理' },
    ]);

    expect(dialog.state.steps.map((s) => s.label)).toEqual(['取得', '処理']);
    expect(dialog.state.steps.map((s) => s.key)).toEqual(['a', 'b']);
  });

  it('applies the options to the initial body', () => {
    dialog.showSteps(['a'], {
      title: '同期処理',
      label: '準備中',
      description: 'しばらくお待ちください',
      allowEscapeKey: true,
    });

    expect(dialog.state.title).toBe('同期処理');
    expect(dialog.state.label).toBe('準備中');
    expect(dialog.state.description).toBe('しばらくお待ちください');
    expect(dialog.state.allowEscapeKey).toBe(true);
  });

  it('survives every body swap', () => {
    dialog.showSteps(['取得', '処理', '通知']);
    dialog.activateStep('取得');
    dialog.completeStep('取得');
    dialog.activateStep('処理');

    dialog.showQueue(['a', 'b']);
    expect(dialog.state.dialogType).toBe('queue');
    expect(dialog.state.steps).toHaveLength(3);

    dialog.form(z.object({ x: z.string() }));
    expect(dialog.state.dialogType).toBe('form');
    expect(dialog.state.steps).toHaveLength(3);

    dialog.alert('通知');
    expect(dialog.state.dialogType).toBe('alert');
    expect(dialog.state.steps).toHaveLength(3);

    dialog.showLoading('処理中');
    expect(dialog.state.dialogType).toBe('loading');
    expect(stepStatuses(dialog.state.steps)).toBe('取得:done 処理:active 通知:pending');
    expect(dialog.state.stepIndex).toBe(1);
  });

  it('keeps "active" singular — activateStep demotes the previous one', () => {
    dialog.showSteps(['a', 'b', 'c']);
    dialog.activateStep('a');
    dialog.activateStep('c');

    expect(stepStatuses(dialog.state.steps)).toBe('a:pending b:pending c:active');
    expect(dialog.state.stepIndex).toBe(2);
  });

  it('does not demote finished steps when moving on', () => {
    dialog.showSteps(['a', 'b', 'c']);
    dialog.activateStep('a');
    dialog.completeStep('a');
    dialog.activateStep('b');
    dialog.skipStep('b');
    dialog.activateStep('c');

    expect(stepStatuses(dialog.state.steps)).toBe('a:done b:skipped c:active');
  });

  it.each([
    ['completeStep', 'done'],
    ['skipStep', 'skipped'],
    ['failStep', 'error'],
  ] as const)('%s sets the status without moving the current position', (method, status) => {
    dialog.showSteps(['a', 'b']);
    dialog.activateStep('a');

    dialog[method]('a');

    expect(dialog.state.steps[0].status).toBe(status);
    expect(dialog.state.stepIndex).toBe(0);
  });

  it('ignores status changes and activation for unknown keys', () => {
    dialog.showSteps(['a']);
    dialog.activateStep('a');

    dialog.activateStep('nope');
    dialog.completeStep('nope');

    expect(stepStatuses(dialog.state.steps)).toBe('a:active');
    expect(dialog.state.stepIndex).toBe(0);
  });

  it('setStepItems replaces the items and resets the position', () => {
    dialog.showSteps(['a', 'b']);
    dialog.activateStep('b');

    dialog.setStepItems(['x']);

    expect(stepStatuses(dialog.state.steps)).toBe('x:pending');
    expect(dialog.state.stepIndex).toBe(-1);
  });
});

// ═══════════════════════════════════════════════════════════════
// Steps — 寿命
// ═══════════════════════════════════════════════════════════════

describe('steps chrome lifetime', () => {
  it('is not disposed when an embedded confirm resolves', async () => {
    dialog.showSteps(['一', '二']);
    dialog.activateStep('一');

    const pending = dialog.confirm('よろしいですか？');
    dialog.onConfirm();

    await expect(pending).resolves.toBe(true);
    expect(dialog.state.steps).toHaveLength(2);
    expect(dialog.state.stepIndex).toBe(0);
    expect(dialog.state.open).toBe(true);
    expect(dialog.state.dialogType).toBe('loading');
  });

  it('is not disposed when an embedded alert is cancelled', async () => {
    dialog.showSteps(['一']);
    dialog.activateStep('一');

    const pending = dialog.alert({ title: 'お知らせ', showCancelButton: true });
    dialog.onCancel();

    await expect(pending).resolves.toMatchObject({ isCanceled: true });
    expect(dialog.state.steps).toHaveLength(1);
    expect(dialog.state.open).toBe(true);
  });

  it('keeps queue progress so the queue body can be resumed', async () => {
    dialog.showSteps(['処理']);
    dialog.activateStep('処理');
    dialog.showQueue(['a', 'b', 'c']);
    dialog.completeQueue('a');
    dialog.activateQueue('b');

    const pending = dialog.confirm('続行しますか？');
    dialog.onConfirm();
    await pending;

    expect(dialog.state.queues.map((q) => q.status)).toEqual(['done', 'active', 'pending']);

    dialog.show({ type: 'queue' });
    expect(dialog.state.dialogType).toBe('queue');
    expect(dialog.state.queues.map((q) => q.status)).toEqual(['done', 'active', 'pending']);
  });

  it('clearSteps disposes the chrome but leaves the dialog open', () => {
    dialog.showSteps(['a']);
    dialog.activateStep('a');

    dialog.clearSteps();

    expect(dialog.state.steps).toHaveLength(0);
    expect(dialog.state.stepIndex).toBe(-1);
    expect(dialog.state.open).toBe(true);
  });

  it('hide disposes the chrome and closes the dialog', () => {
    dialog.showSteps(['a']);

    dialog.hide();

    expect(dialog.state.steps).toHaveLength(0);
    expect(dialog.state.open).toBe(false);
  });

  it('closes fully on confirm when no chrome is present', async () => {
    const pending = dialog.confirm('削除しますか？');
    dialog.onConfirm();

    await pending;
    expect(dialog.state.open).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// Step Form — steps クロームとの合成
// ═══════════════════════════════════════════════════════════════

const wizardSteps = () => [
  { key: 'personal', label: '個人情報', schema: z.object({ name: z.string().min(1) }) },
  { key: 'settings', label: '設定', schema: z.object({ role: z.enum(['admin', 'viewer']) }) },
  { key: 'confirm', label: '確認', description: '内容をご確認ください' },
];

describe('step form', () => {
  it('drives the shared steps chrome rather than its own state', () => {
    dialog.showStepForm(wizardSteps());

    expect(dialog.state.dialogType).toBe('step-form');
    expect(stepStatuses(dialog.state.steps)).toBe(
      'personal:active settings:pending confirm:pending'
    );
    expect(dialog.state.stepIndex).toBe(0);
  });

  it('projects the current step form into the shared form state', () => {
    dialog.showStepForm(wizardSteps());

    expect(dialog.state.formFields.map((f) => f.key)).toEqual(['name']);

    dialog.updateFormField('name', '太郎');
    dialog.onStepNext();

    expect(dialog.state.formFields.map((f) => f.key)).toEqual(['role']);
    expect(dialog.state.description).toBe('');

    dialog.updateFormField('role', 'admin');
    dialog.onStepNext();

    expect(dialog.state.formFields).toEqual([]);
    expect(dialog.state.description).toBe('内容をご確認ください');
  });

  it('seeds values from schema defaults and explicit defaultValues', () => {
    dialog.showStepForm([
      {
        key: 'a',
        label: 'A',
        schema: z.object({
          fromSchema: z.boolean().default(true),
          overridden: z.string().default('schema'),
        }),
        defaultValues: { overridden: 'explicit' },
      },
    ]);

    expect(dialog.state.formValues).toEqual({ fromSchema: true, overridden: 'explicit' });
  });

  it('blocks navigation on validation failure and marks fields touched', () => {
    dialog.showStepForm(wizardSteps());

    dialog.onStepNext();

    expect(dialog.state.stepIndex).toBe(0);
    expect(dialog.state.formErrors.name).toBeTruthy();
    expect(dialog.state.formTouched.name).toBe(true);
    expect(dialog.state.steps[0].status).toBe('active');
  });

  it('advances and marks the completed step done', () => {
    dialog.showStepForm(wizardSteps());
    dialog.updateFormField('name', '太郎');

    dialog.onStepNext();

    expect(dialog.state.stepIndex).toBe(1);
    expect(stepStatuses(dialog.state.steps)).toBe(
      'personal:done settings:active confirm:pending'
    );
  });

  it('rewinds without validating and preserves entered values', () => {
    dialog.showStepForm(wizardSteps());
    dialog.updateFormField('name', '太郎');
    dialog.onStepNext();

    dialog.onStepPrev();

    expect(dialog.state.stepIndex).toBe(0);
    expect(stepStatuses(dialog.state.steps)).toBe(
      'personal:active settings:pending confirm:pending'
    );
    expect(dialog.state.formValues.name).toBe('太郎');
  });

  it('ignores onStepPrev on the first step', () => {
    dialog.showStepForm(wizardSteps());

    dialog.onStepPrev();

    expect(dialog.state.stepIndex).toBe(0);
  });

  it('resolves with every schema-backed step keyed by step key', async () => {
    const pending = dialog.showStepForm(wizardSteps());

    dialog.updateFormField('name', '太郎');
    dialog.onStepNext();
    dialog.updateFormField('role', 'admin');
    dialog.onStepNext();
    dialog.onStepNext();

    await expect(pending).resolves.toEqual({
      personal: { name: '太郎' },
      settings: { role: 'admin' },
    });
    expect(dialog.state.open).toBe(false);
    expect(dialog.state.steps).toHaveLength(0);
  });

  it('resolves null and disposes its chrome on cancel', async () => {
    const pending = dialog.showStepForm(wizardSteps());

    dialog.onCancel();

    await expect(pending).resolves.toBeNull();
    expect(dialog.state.open).toBe(false);
    expect(dialog.state.steps).toHaveLength(0);
  });

  it('resolves null and disposes its chrome when interrupted', async () => {
    const pending = dialog.showStepForm(wizardSteps());

    dialog.alert('割り込み');

    await expect(pending).resolves.toBeNull();
    expect(dialog.state.steps).toHaveLength(0);
    expect(dialog.state.dialogType).toBe('alert');
  });

  it('does not let a stale wizard clear a newer one', async () => {
    const first = dialog.showStepForm([{ key: 'a', label: 'A' }]);
    const second = dialog.showStepForm([{ key: 'b', label: 'B' }]);

    await expect(first).resolves.toBeNull();

    // 2つめのウィザードは 1つめの後始末に巻き込まれず、そのまま操作できる
    expect(dialog.state.steps.map((s) => s.key)).toEqual(['b']);
    dialog.onStepNext();
    await expect(second).resolves.toEqual({});
  });

  it('applies the configured button texts', () => {
    dialog.showStepForm(wizardSteps(), {
      nextButtonText: 'Next',
      prevButtonText: 'Back',
      submitButtonText: 'Submit',
      cancelButtonText: 'Cancel',
      title: '登録',
    });

    expect(dialog.state.stepFormNextText).toBe('Next');
    expect(dialog.state.stepFormPrevText).toBe('Back');
    expect(dialog.state.stepFormSubmitText).toBe('Submit');
    expect(dialog.state.cancelButtonText).toBe('Cancel');
    expect(dialog.state.title).toBe('登録');
  });

  it('ignores navigation when no wizard is running', () => {
    dialog.showSteps(['a']);
    dialog.activateStep('a');

    dialog.onStepNext();
    dialog.onStepPrev();

    expect(dialog.state.stepIndex).toBe(0);
    expect(dialog.state.steps[0].status).toBe('active');
  });
});

// ═══════════════════════════════════════════════════════════════
// Step Form — skipStep / failStep との連携 (今回の主眼)
// ═══════════════════════════════════════════════════════════════

describe('step form with skipStep / failStep', () => {
  it('steps over a skipped step when advancing', () => {
    dialog.showStepForm(wizardSteps());
    dialog.updateFormField('name', '太郎');

    dialog.skipStep('settings');
    dialog.onStepNext();

    expect(stepStatuses(dialog.state.steps)).toBe(
      'personal:done settings:skipped confirm:active'
    );
    expect(dialog.state.stepIndex).toBe(2);
  });

  it('steps over a skipped step when rewinding', () => {
    dialog.showStepForm(wizardSteps());
    dialog.updateFormField('name', '太郎');
    dialog.skipStep('settings');
    dialog.onStepNext();

    dialog.onStepPrev();

    expect(dialog.state.stepIndex).toBe(0);
  });

  it('omits a skipped step from the resolved data', async () => {
    const pending = dialog.showStepForm(wizardSteps());

    dialog.updateFormField('name', '太郎');
    dialog.skipStep('settings');
    dialog.onStepNext();
    dialog.onStepNext();

    await expect(pending).resolves.toEqual({ personal: { name: '太郎' } });
  });

  it('does not validate or complete a step that is already skipped', () => {
    dialog.showStepForm(wizardSteps());

    // 必須項目が未入力のまま skip → 検証で止まらず素通りする
    dialog.skipStep('personal');
    dialog.onStepNext();

    expect(dialog.state.stepIndex).toBe(1);
    expect(dialog.state.steps[0].status).toBe('skipped');
  });

  it('treats a wizard whose remaining steps are all skipped as complete', async () => {
    const pending = dialog.showStepForm(wizardSteps());

    dialog.updateFormField('name', '太郎');
    dialog.skipStep('settings');
    dialog.skipStep('confirm');
    dialog.onStepNext();

    await expect(pending).resolves.toEqual({ personal: { name: '太郎' } });
    expect(dialog.state.open).toBe(false);
  });

  it('failStep marks the current step without leaving it', () => {
    dialog.showStepForm(wizardSteps());

    dialog.failStep('personal');

    expect(stepStatuses(dialog.state.steps)).toBe(
      'personal:error settings:pending confirm:pending'
    );
    expect(dialog.state.stepIndex).toBe(0);
    expect(dialog.state.dialogType).toBe('step-form');
    expect(dialog.state.formFields.map((f) => f.key)).toEqual(['name']);
  });

  it('recovers a failed step to done once validation passes', () => {
    dialog.showStepForm(wizardSteps());
    dialog.failStep('personal');

    dialog.updateFormField('name', '太郎');
    dialog.onStepNext();

    expect(stepStatuses(dialog.state.steps)).toBe(
      'personal:done settings:active confirm:pending'
    );
  });

  it('lets a caller re-activate a skipped step', () => {
    dialog.showStepForm(wizardSteps());
    dialog.skipStep('settings');

    dialog.activateStep('settings');

    expect(dialog.state.stepIndex).toBe(1);
    expect(dialog.state.steps[1].status).toBe('active');
    expect(dialog.state.formFields.map((f) => f.key)).toEqual(['role']);
  });
});

// ═══════════════════════════════════════════════════════════════
// Form — 単発 / ウィザードで共有される更新経路
// ═══════════════════════════════════════════════════════════════

describe('form', () => {
  const schema = z.object({
    name: z.string().min(1).describe('名前'),
    age: z.number().min(0).optional().describe('年齢'),
  });

  it('extracts fields and seeds defaults', () => {
    dialog.form(z.object({ active: z.boolean().default(true) }));

    expect(dialog.state.dialogType).toBe('form');
    expect(dialog.state.formValues).toEqual({ active: true });
  });

  it('resolves with parsed data on confirm', async () => {
    const pending = dialog.form(schema);

    dialog.updateFormField('name', '花子');
    dialog.onConfirm();

    await expect(pending).resolves.toEqual({ name: '花子' });
  });

  it('resolves null on cancel', async () => {
    const pending = dialog.form(schema);

    dialog.onCancel();

    await expect(pending).resolves.toBeNull();
  });

  it('refuses to confirm while invalid and marks every field touched', () => {
    dialog.form(schema);

    dialog.onConfirm();

    expect(dialog.state.open).toBe(true);
    expect(dialog.state.formErrors.name).toBeTruthy();
    expect(dialog.state.formTouched.name).toBe(true);
  });

  it('validates on change and clears the error once fixed', () => {
    dialog.form(schema);

    dialog.updateFormField('name', '');
    expect(dialog.state.formErrors.name).toBeTruthy();

    dialog.updateFormField('name', '花子');
    expect(dialog.state.formErrors.name).toBeUndefined();
  });

  it('skips change validation when validateOnChange is off', () => {
    dialog.form(schema, { validateOnChange: false });

    dialog.updateFormField('name', '');

    expect(dialog.state.formErrors.name).toBeUndefined();
    expect(dialog.state.formTouched.name).toBe(true);
  });

  it('validates on blur via touchFormField', () => {
    dialog.form(schema);

    dialog.touchFormField('name');

    expect(dialog.state.formTouched.name).toBe(true);
    expect(dialog.state.formErrors.name).toBeTruthy();
  });

  it('skips blur validation when validateOnBlur is off', () => {
    dialog.form(schema, { validateOnBlur: false });

    dialog.touchFormField('name');

    expect(dialog.state.formErrors.name).toBeUndefined();
  });

  it('only reports the error belonging to the edited field', () => {
    dialog.form(schema);

    dialog.updateFormField('age', -1);

    expect(dialog.state.formErrors.age).toBeTruthy();
    expect(dialog.state.formErrors.name).toBeUndefined();
  });

  it('does not let a stale form session clear a newer one', async () => {
    const first = dialog.form(schema);
    const second = dialog.form(schema);

    await expect(first).resolves.toBeNull();

    dialog.updateFormField('name', '花子');
    dialog.onConfirm();
    await expect(second).resolves.toEqual({ name: '花子' });
  });
});

// ═══════════════════════════════════════════════════════════════
// Queue
// ═══════════════════════════════════════════════════════════════

describe('queue', () => {
  it('opens with every item pending', () => {
    dialog.showQueue(['前処理', '検証'], 'アップロード');

    expect(dialog.state.dialogType).toBe('queue');
    expect(dialog.state.queues.map((q) => q.status)).toEqual(['pending', 'pending']);
    expect(dialog.state.title).toBe('アップロード');
  });

  it.each([
    ['activateQueue', 'active'],
    ['completeQueue', 'done'],
    ['skipQueue', 'skipped'],
    ['failQueue', 'error'],
  ] as const)('%s updates only the addressed item', (method, status) => {
    dialog.showQueue(['a', 'b']);

    dialog[method]('a');

    expect(dialog.state.queues[0].status).toBe(status);
    expect(dialog.state.queues[1].status).toBe('pending');
  });

  it('ignores unknown keys', () => {
    dialog.showQueue(['a']);

    dialog.completeQueue('nope');

    expect(dialog.state.queues[0].status).toBe('pending');
  });

  it('clearQueue empties the list', () => {
    dialog.showQueue(['a']);

    dialog.clearQueue();

    expect(dialog.state.queues).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Alert / Confirm / Loading
// ═══════════════════════════════════════════════════════════════

describe('alert and confirm', () => {
  it('accepts a bare string as the title', () => {
    dialog.alert('保存しました');

    expect(dialog.state.title).toBe('保存しました');
    expect(dialog.state.icon).toBe('info');
    expect(dialog.state.showConfirmButton).toBe(true);
    expect(dialog.state.showCancelButton).toBe(false);
  });

  it('reports the outcome of each dismissal path', async () => {
    const confirmed = dialog.alert('a');
    dialog.onConfirm();
    await expect(confirmed).resolves.toEqual({
      isConfirmed: true,
      isCanceled: false,
      isDismissed: false,
    });

    const canceled = dialog.alert('b');
    dialog.onCancel();
    await expect(canceled).resolves.toEqual({
      isConfirmed: false,
      isCanceled: true,
      isDismissed: false,
    });

    const dismissed = dialog.alert('c');
    dialog.alert('d');
    await expect(dismissed).resolves.toEqual({
      isConfirmed: false,
      isCanceled: false,
      isDismissed: true,
    });
  });

  it('defaults confirm to a warning icon and both buttons', () => {
    dialog.confirm('削除しますか？');

    expect(dialog.state.icon).toBe('warning');
    expect(dialog.state.showConfirmButton).toBe(true);
    expect(dialog.state.showCancelButton).toBe(true);
  });

  it('resolves confirm to a boolean', async () => {
    const yes = dialog.confirm('a');
    dialog.onConfirm();
    await expect(yes).resolves.toBe(true);

    const no = dialog.confirm('b');
    dialog.onCancel();
    await expect(no).resolves.toBe(false);
  });

  it('tracks loading progress and label updates', () => {
    dialog.showLoading('読み込み中');
    expect(dialog.state.dialogType).toBe('loading');
    expect(dialog.state.label).toBe('読み込み中');

    dialog.setProgress(50);
    dialog.setLabel('半分完了');
    dialog.setDescription('もう少しです');

    expect(dialog.state.progress).toBe(50);
    expect(dialog.state.label).toBe('半分完了');
    expect(dialog.state.description).toBe('もう少しです');
  });

  it('resets a leftover title when a new body opens', () => {
    dialog.showQueue(['a'], 'キュー');

    dialog.show({ type: 'loading' });

    expect(dialog.state.title).toBe('');
  });
});

describe('dismissal guards', () => {
  it('honours allowOutsideClick', async () => {
    const blocked = dialog.confirm({ title: 'a', allowOutsideClick: false });
    dialog.onOutsideClick();
    expect(dialog.state.open).toBe(true);

    dialog.hide();
    await blocked;

    const allowed = dialog.confirm({ title: 'b', allowOutsideClick: true });
    dialog.onOutsideClick();
    await expect(allowed).resolves.toBe(false);
  });

  it('honours allowEscapeKey', async () => {
    const blocked = dialog.confirm({ title: 'a', allowEscapeKey: false });
    dialog.onEscapeKey();
    expect(dialog.state.open).toBe(true);

    dialog.hide();
    await blocked;

    const allowed = dialog.confirm({ title: 'b', allowEscapeKey: true });
    dialog.onEscapeKey();
    await expect(allowed).resolves.toBe(false);
  });
});

describe('alert timer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('auto-dismisses after the timer elapses', async () => {
    const pending = dialog.alert({ title: 'a', timer: 3000 });

    vi.advanceTimersByTime(3000);

    await expect(pending).resolves.toMatchObject({ isDismissed: true });
    expect(dialog.state.open).toBe(false);
  });

  it('returns to the neutral body instead of closing when the chrome is up', async () => {
    dialog.showSteps(['a']);
    dialog.activateStep('a');
    const pending = dialog.alert({ title: 'a', timer: 1000 });

    vi.advanceTimersByTime(1000);

    await pending;
    expect(dialog.state.open).toBe(true);
    expect(dialog.state.steps).toHaveLength(1);
  });

  it('cancels the timer when the dialog is settled first', async () => {
    const pending = dialog.alert({ title: 'a', timer: 1000 });
    dialog.onConfirm();
    await expect(pending).resolves.toMatchObject({ isConfirmed: true });

    // タイマーが生き残っていれば、この時点で state が壊される
    dialog.showLoading('次の処理');
    vi.advanceTimersByTime(5000);

    expect(dialog.state.open).toBe(true);
    expect(dialog.state.label).toBe('次の処理');
  });
});

// ═══════════════════════════════════════════════════════════════
// Observability / configuration
// ═══════════════════════════════════════════════════════════════

describe('subscribe', () => {
  it('notifies listeners with a fresh snapshot on every update', () => {
    const seen: boolean[] = [];
    dialog.subscribe((s) => seen.push(s.open));

    dialog.showLoading();
    dialog.hide();

    expect(seen).toEqual([true, false]);
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = dialog.subscribe(listener);

    dialog.showLoading();
    unsubscribe();
    dialog.hide();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('hands out an immutable-looking snapshot, not the live state object', () => {
    let snapshot: unknown;
    dialog.subscribe((s) => (snapshot = s));

    dialog.showLoading('a');
    const first = snapshot;
    dialog.setLabel('b');

    expect(snapshot).not.toBe(first);
    expect((first as { label: string }).label).toBe('a');
  });
});

describe('configure', () => {
  it('overrides the default texts', () => {
    dialog.configure({ texts: { confirmButtonText: 'OK!', cancelButtonText: 'Nope' } });

    dialog.confirm('a');

    expect(dialog.state.confirmButtonText).toBe('OK!');
    expect(dialog.state.cancelButtonText).toBe('Nope');
    expect(dialog.texts.confirmButtonText).toBe('OK!');
  });

  it('keeps texts that were not overridden', () => {
    dialog.configure({ texts: { confirmButtonText: 'OK!' } });

    expect(dialog.texts.stepFormNextText).toBe('次へ');
  });

  it('routes html through the configured sanitizer', () => {
    dialog.configure({ sanitizeHtml: (html) => html.replace(/<script>.*<\/script>/g, '') });

    dialog.show({ type: 'loading', html: 'safe<script>evil()</script>' });
    expect(dialog.state.html).toBe('safe');

    dialog.setHtml('more<script>evil()</script>');
    expect(dialog.state.html).toBe('more');
  });

  it('leaves html untouched when no sanitizer is configured', () => {
    dialog.setHtml('<b>bold</b>');

    expect(dialog.state.html).toBe('<b>bold</b>');
  });
});

// ═══════════════════════════════════════════════════════════════
// Width
// ═══════════════════════════════════════════════════════════════

describe('width', () => {
  it('defaults to null (= the CSS default for the dialog type)', () => {
    dialog.showLoading('読み込み中');
    expect(dialog.state.width).toBeNull();
  });

  it.each([
    ['show', () => dialog.show({ type: 'loading', width: 'lg' })],
    ['alert', () => dialog.alert({ title: 'a', width: 'lg' })],
    ['confirm', () => dialog.confirm({ title: 'a', width: 'lg' })],
    ['showSteps', () => dialog.showSteps(['a'], { width: 'lg' })],
    ['form', () => dialog.form(z.object({ x: z.string() }), { width: 'lg' })],
    ['showStepForm', () => dialog.showStepForm([{ key: 'a', label: 'A' }], { width: 'lg' })],
  ])('%s applies the width option', (_name, open) => {
    open();
    expect(dialog.state.width).toBe('var(--dialog-width-lg)');
  });

  it('resolves numbers to px and strings as-is', () => {
    dialog.show({ type: 'loading', width: 720 });
    expect(dialog.state.width).toBe('720px');

    dialog.show({ type: 'loading', width: 'clamp(320px, 60vw, 720px)' });
    expect(dialog.state.width).toBe('clamp(320px, 60vw, 720px)');
  });

  it('falls back to null on an invalid value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    dialog.show({ type: 'loading', width: '400px; background: red' });

    expect(dialog.state.width).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('resets to the type default when the next body omits width', () => {
    dialog.alert({ title: 'wide', width: 'xl' });
    expect(dialog.state.width).toBe('var(--dialog-width-xl)');

    dialog.confirm('normal');
    expect(dialog.state.width).toBeNull();
  });

  it('is cleared by hide()', () => {
    dialog.show({ type: 'loading', width: 'xl' });
    dialog.hide();
    expect(dialog.state.width).toBeNull();
  });

  it('resets when a body closes back to the steps chrome', async () => {
    dialog.showSteps(['a', 'b']);
    const pending = dialog.confirm({ title: '続行しますか', width: 'xl' });
    expect(dialog.state.width).toBe('var(--dialog-width-xl)');

    dialog.onCancel();
    await pending;

    expect(dialog.state.open).toBe(true);
    expect(dialog.state.steps).toHaveLength(2);
    expect(dialog.state.width).toBeNull();
  });

  describe('setWidth()', () => {
    it('changes the width of the open dialog', () => {
      dialog.showLoading('処理中');
      dialog.setWidth(640);
      expect(dialog.state.width).toBe('640px');
    });

    it('accepts null to go back to the type default', () => {
      dialog.show({ type: 'loading', width: 'xl' });
      dialog.setWidth(null);
      expect(dialog.state.width).toBeNull();
    });

    it('notifies subscribers', () => {
      const listener = vi.fn();
      dialog.subscribe(listener);
      dialog.setWidth('lg');
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ width: 'var(--dialog-width-lg)' }));
    });

    it('is overwritten by the next body call', () => {
      dialog.showLoading('処理中');
      dialog.setWidth(640);
      dialog.showLoading('次の処理');
      expect(dialog.state.width).toBeNull();
    });
  });

  describe('step form', () => {
    const steps = [
      { key: 'a', label: 'A', schema: z.object({ x: z.string() }) },
      { key: 'b', label: 'B', schema: z.object({ y: z.string() }), width: 'xl' as const },
      { key: 'c', label: 'C', schema: z.object({ z: z.string() }) },
    ];

    it('uses the per-step width while that step is active', () => {
      dialog.showStepForm(steps, { width: 'lg' });
      expect(dialog.state.width).toBe('var(--dialog-width-lg)');

      dialog.updateFormField('x', 'ok');
      dialog.onStepNext();
      expect(dialog.state.width).toBe('var(--dialog-width-xl)');
    });

    it('falls back to the session width on steps without their own', () => {
      dialog.showStepForm(steps, { width: 'lg' });
      dialog.updateFormField('x', 'ok');
      dialog.onStepNext();
      dialog.updateFormField('y', 'ok');
      dialog.onStepNext();

      expect(dialog.state.width).toBe('var(--dialog-width-lg)');
    });

    it('keeps the step width across field edits', () => {
      dialog.showStepForm(steps, { width: 'lg' });
      dialog.updateFormField('x', 'ok');
      dialog.onStepNext();
      dialog.updateFormField('y', 'typing');

      expect(dialog.state.width).toBe('var(--dialog-width-xl)');
    });

    it('restores the previous step width when going back', () => {
      dialog.showStepForm(steps, { width: 'lg' });
      dialog.updateFormField('x', 'ok');
      dialog.onStepNext();
      dialog.onStepPrev();

      expect(dialog.state.width).toBe('var(--dialog-width-lg)');
    });

    it('clears the width when the wizard is submitted', () => {
      dialog.showStepForm([{ key: 'a', label: 'A' }], { width: 'xl' });
      dialog.onStepNext();
      expect(dialog.state.width).toBeNull();
    });
  });
});
