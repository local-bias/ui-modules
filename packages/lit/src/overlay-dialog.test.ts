import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { DialogController } from './controller';
import { overlayStyles } from './styles';
import { mountDialog, text } from './test-utils';
import './overlay-dialog';

let dialog: DialogController;
let root: ShadowRoot;
let update: () => Promise<ShadowRoot>;
let cleanup: () => void;

beforeEach(async () => {
  dialog = new DialogController();
  const mounted = await mountDialog(dialog);
  root = mounted.root;
  update = mounted.update;
  cleanup = mounted.cleanup;
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

// ═══════════════════════════════════════════════════════════════
// Steps chrome — 常駐であることの DOM レベルの裏取り
// ═══════════════════════════════════════════════════════════════

describe('steps chrome placement', () => {
  it('is not rendered when there are no steps', async () => {
    dialog.showLoading('読み込み中');
    await update();

    expect(root.querySelector('.steps-chrome')).toBeNull();
  });

  it('sits inside .card but outside .card-body', async () => {
    dialog.showSteps(['a', 'b']);
    await update();

    const chrome = root.querySelector('.steps-chrome');
    expect(chrome).not.toBeNull();
    expect(chrome!.parentElement).toBe(root.querySelector('.card'));
    expect(root.querySelector('.card-body')!.contains(chrome!)).toBe(false);
  });

  it('renders one labelled item per step', async () => {
    dialog.showSteps(['取得', '処理', '通知']);
    await update();

    expect(root.querySelectorAll('.step-item')).toHaveLength(3);
    expect(root.querySelectorAll('.step-dot')).toHaveLength(3);
    expect([...root.querySelectorAll('.step-label')].map((l) => l.textContent!.trim())).toEqual([
      '取得',
      '処理',
      '通知',
    ]);
  });

  it('shows every label, not just the current one', async () => {
    dialog.showSteps(['取得', '処理', '通知']);
    dialog.activateStep('処理');
    await update();

    expect(root.querySelectorAll('.step-label')).toHaveLength(3);
  });

  it('labels steps given as key/label pairs with the label, not the key', async () => {
    dialog.showSteps([
      { key: 'fetch', label: 'データ取得' },
      { key: 'process', label: 'ファイル処理' },
    ]);
    await update();

    expect([...root.querySelectorAll('.step-label')].map((l) => l.textContent!.trim())).toEqual([
      'データ取得',
      'ファイル処理',
    ]);
  });

  it('reflects each step status onto its item and dot', async () => {
    dialog.showSteps(['a', 'b', 'c', 'd']);
    dialog.completeStep('a');
    dialog.skipStep('b');
    dialog.failStep('c');
    dialog.activateStep('d');
    await update();

    const statuses = ['done', 'skipped', 'error', 'active'];
    expect(
      [...root.querySelectorAll('.step-item')].map((d) => d.getAttribute('data-status'))
    ).toEqual(statuses);
    expect(
      [...root.querySelectorAll('.step-dot')].map((d) => d.getAttribute('data-status'))
    ).toEqual(statuses);
  });

  it('renders the labels as an ordered list', async () => {
    dialog.showSteps(['a', 'b']);
    await update();

    const list = root.querySelector('.steps-header')!;
    expect(list.tagName).toBe('OL');
    expect([...list.children].every((c) => c.tagName === 'LI')).toBe(true);
  });

  it('hides the counter until a step is activated', async () => {
    dialog.showSteps(['a', 'b']);
    await update();

    expect(root.querySelector('.steps-counter')).toBeNull();
    expect(root.querySelector('#dialog-step-label')).toBeNull();
    // ラベルは現在位置に関係なく最初から出る
    expect(root.querySelectorAll('.step-label')).toHaveLength(2);

    dialog.activateStep('b');
    await update();

    expect(text(root, '.steps-counter')).toBe('2 / 2');
  });

  it('names the dialog after the active step label', async () => {
    dialog.showSteps(['取得', '処理']);
    dialog.activateStep('処理');
    await update();

    expect(text(root, '#dialog-step-label')).toBe('処理');
    expect(root.querySelectorAll('#dialog-step-label')).toHaveLength(1);
  });

  it('moves the current-step id and aria-current as the flow advances', async () => {
    dialog.showSteps(['a', 'b']);
    dialog.activateStep('a');
    await update();

    const current = () =>
      [...root.querySelectorAll('.step-item')].findIndex(
        (li) => li.getAttribute('aria-current') === 'step'
      );

    expect(current()).toBe(0);
    expect(text(root, '#dialog-step-label')).toBe('a');

    dialog.completeStep('a');
    dialog.activateStep('b');
    await update();

    expect(current()).toBe(1);
    expect(root.querySelectorAll('[aria-current]')).toHaveLength(1);
    expect(text(root, '#dialog-step-label')).toBe('b');
  });

  it('marks no step current before the flow starts', async () => {
    dialog.showSteps(['a', 'b']);
    await update();

    expect(root.querySelectorAll('[aria-current]')).toHaveLength(0);
  });

  it('keeps the dot nodes alive across a body swap instead of re-creating them', async () => {
    dialog.showSteps(['a', 'b']);
    dialog.activateStep('a');
    await update();

    const dotsBefore = [...root.querySelectorAll('.step-dot')];
    const bodyBefore = root.querySelector('.body-inner');

    dialog.showQueue(['task']);
    await update();

    const dotsAfter = [...root.querySelectorAll('.step-dot')];
    expect(dotsAfter[0]).toBe(dotsBefore[0]);
    expect(dotsAfter[1]).toBe(dotsBefore[1]);
    // 対照 — 本文は keyed() 配下なので作り直される
    expect(root.querySelector('.body-inner')).not.toBe(bodyBefore);
  });

  it('stays rendered through loading → queue → form → alert', async () => {
    dialog.showSteps(['a', 'b']);
    dialog.activateStep('a');

    for (const swap of [
      () => dialog.showQueue(['t']),
      () => dialog.form(z.object({ x: z.string() })),
      () => dialog.alert('通知'),
      () => dialog.showLoading('処理中'),
    ]) {
      swap();
      await update();
      expect(root.querySelector('.steps-chrome')).not.toBeNull();
      expect(root.querySelectorAll('.step-dot')).toHaveLength(2);
    }
  });

  it('disappears once clearSteps is called', async () => {
    dialog.showSteps(['a']);
    await update();
    expect(root.querySelector('.steps-chrome')).not.toBeNull();

    dialog.clearSteps();
    await update();

    expect(root.querySelector('.steps-chrome')).toBeNull();
  });

  it('hides the decorative dots from assistive tech but keeps the labels readable', async () => {
    dialog.showSteps(['取得']);
    await update();

    expect(root.querySelector('.step-dot')!.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelector('.steps-header')!.hasAttribute('aria-hidden')).toBe(false);
    expect(root.querySelector('.step-label')!.hasAttribute('aria-hidden')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// Body rendering
// ═══════════════════════════════════════════════════════════════

describe('body rendering', () => {
  it('renders a spinner for the loading body', async () => {
    dialog.showLoading('読み込み中');
    await update();

    expect(root.querySelector('.spinner')).not.toBeNull();
    expect(text(root, '#dialog-label')).toBe('読み込み中');
  });

  it('renders alert content and buttons', async () => {
    dialog.alert({
      type: 'success',
      title: '完了',
      description: '処理が終わりました',
      showCancelButton: true,
    });
    await update();

    expect(text(root, '#dialog-label')).toBe('完了');
    expect(text(root, '#dialog-description')).toBe('処理が終わりました');
    expect(root.querySelector('.btn-confirm')).not.toBeNull();
    expect(root.querySelector('.btn-cancel')).not.toBeNull();
  });

  it('renders raw html through unsafeHTML', async () => {
    dialog.show({ type: 'loading', html: '<b class="marker">bold</b>' });
    await update();

    expect(root.querySelector('.html-content .marker')).not.toBeNull();
  });

  it('renders the queue list with a progress count', async () => {
    dialog.showQueue(['a', 'b', 'c']);
    dialog.completeQueue('a');
    await update();

    expect(root.querySelectorAll('.task-item')).toHaveLength(3);
    expect(text(root, '.queue-progress-count-v')).toBe('1/3');
  });

  it('windows a long queue around the active item and counts what is hidden', async () => {
    dialog.showQueue(['1', '2', '3', '4', '5', '6', '7', '8']);
    dialog.activateQueue('5');
    await update();

    // active(index 4) を中心に 3 件 — 上に 3 件、下に 2 件が隠れる
    expect(root.querySelectorAll('.queue-ellipsis')).toHaveLength(2);
    expect([...root.querySelectorAll('.task-label')].map((l) => l.textContent)).toEqual([
      '4',
      '5',
      '6',
    ]);
    expect(
      [...root.querySelectorAll('.queue-ellipsis-badge')].map((b) => b.textContent)
    ).toEqual(['+3', '+2']);
  });

  it('shows no leading ellipsis while the queue is still near the head', async () => {
    dialog.showQueue(['1', '2', '3', '4', '5', '6']);
    dialog.activateQueue('1');
    await update();

    expect(root.querySelectorAll('.queue-ellipsis')).toHaveLength(1);
    expect(text(root, '.queue-ellipsis-badge')).toBe('+2');
  });

  it('drives the confirm/cancel buttons through the controller', async () => {
    const pending = dialog.confirm('よろしいですか？');
    await update();

    root.querySelector<HTMLButtonElement>('.btn-confirm')!.click();

    await expect(pending).resolves.toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Form rendering
// ═══════════════════════════════════════════════════════════════

describe('form rendering', () => {
  const schema = z.object({
    name: z.string().min(1).describe('名前'),
    email: z.string().email().describe('メール'),
    age: z.number().describe('年齢'),
    active: z.boolean().describe('有効'),
    role: z.enum(['admin', 'viewer']).describe('権限'),
    birthday: z.date().describe('誕生日'),
  });

  it('maps each zod type to the right input', async () => {
    dialog.form(schema);
    await update();

    expect(root.querySelector('#form-name')!.getAttribute('type')).toBe('text');
    expect(root.querySelector('#form-email')!.getAttribute('type')).toBe('email');
    expect(root.querySelector('#form-age')!.getAttribute('type')).toBe('number');
    expect(root.querySelector('#form-birthday')!.getAttribute('type')).toBe('date');
    expect(root.querySelector('#form-role')!.tagName).toBe('SELECT');
    expect(root.querySelector('.form-checkbox')).not.toBeNull();
  });

  it('sends input back into the controller', async () => {
    dialog.form(schema);
    await update();

    const input = root.querySelector<HTMLInputElement>('#form-name')!;
    input.value = '花子';
    input.dispatchEvent(new Event('input'));

    expect(dialog.state.formValues.name).toBe('花子');
  });

  it('shows an error only once the field has been touched', async () => {
    dialog.form(schema);
    dialog.updateFormField('name', '');
    await update();
    // updateFormField は touched も立てるので、エラーが出る
    expect(root.querySelector('.form-error')).not.toBeNull();
  });

  it('renders grouped layouts with legends', async () => {
    dialog.form(schema, {
      layout: { groups: [{ label: '基本情報', fields: ['name', 'email'] }], columns: 2 },
    });
    await update();

    expect(text(root, '.form-group-label')).toBe('基本情報');
    expect(root.querySelectorAll('.form-grid').length).toBeGreaterThanOrEqual(2);
  });

  it('honours an explicit field order', async () => {
    dialog.form(schema, { layout: { fieldOrder: ['role', 'name'] } });
    await update();

    const keys = [...root.querySelectorAll('.form-field')].map(
      (f) => f.querySelector('[id^="form-"], .form-checkbox')?.id
    );
    expect(keys[0]).toBe('form-role');
    expect(keys[1]).toBe('form-name');
  });
});

// ═══════════════════════════════════════════════════════════════
// Step form body
// ═══════════════════════════════════════════════════════════════

describe('step form rendering', () => {
  const steps = () => [
    { key: 'a', label: 'ステップA', schema: z.object({ name: z.string().min(1) }) },
    { key: 'b', label: 'ステップB', schema: z.object({ memo: z.string() }) },
    { key: 'c', label: 'ステップC', description: '確認してください' },
  ];

  it('leaves the step indicator to the chrome and renders only the form', async () => {
    dialog.showStepForm(steps());
    await update();

    // インジケータはクローム側に1組だけ
    expect(root.querySelectorAll('.steps-header')).toHaveLength(1);
    expect(root.querySelector('.card-body .steps-header')).toBeNull();
    expect(text(root, '#dialog-step-label')).toBe('ステップA');
    expect(root.querySelector('#form-name')).not.toBeNull();
  });

  it('renders the wizard title in the card header', async () => {
    dialog.showStepForm(steps(), { title: 'ユーザー登録' });
    await update();

    expect(text(root, '#dialog-title')).toBe('ユーザー登録');
  });

  it('hides the back button on the first step', async () => {
    dialog.showStepForm(steps());
    await update();

    expect(root.querySelector('.btn-prev')).toBeNull();
  });

  it('labels the primary button "next" until the final step', async () => {
    dialog.showStepForm(steps(), { nextButtonText: '次へ', submitButtonText: '登録' });
    await update();
    expect(text(root, '.btn-confirm')).toBe('次へ');

    dialog.updateFormField('name', '太郎');
    dialog.onStepNext();
    dialog.updateFormField('memo', 'x');
    dialog.onStepNext();
    await update();

    expect(text(root, '.btn-confirm')).toBe('登録');
    expect(root.querySelector('.btn-prev')).not.toBeNull();
  });

  it('accounts for skipped steps when deciding first/last', async () => {
    dialog.showStepForm(steps());
    dialog.skipStep('b');
    dialog.skipStep('c');
    await update();

    // b と c が飛ばされるので、A が実質の最終ステップ
    expect(text(root, '.btn-confirm')).toBe('OK');
  });

  it('navigates through the rendered buttons', async () => {
    dialog.showStepForm(steps());
    dialog.updateFormField('name', '太郎');
    await update();

    root.querySelector<HTMLButtonElement>('.btn-confirm')!.click();
    await update();
    expect(text(root, '#dialog-step-label')).toBe('ステップB');

    root.querySelector<HTMLButtonElement>('.btn-prev')!.click();
    await update();
    expect(text(root, '#dialog-step-label')).toBe('ステップA');
  });

  it('renders a description-only step with no form', async () => {
    dialog.showStepForm(steps());
    dialog.activateStep('c');
    await update();

    expect(text(root, '#dialog-description')).toBe('確認してください');
    expect(root.querySelector('.form-scroll-container')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// Accessibility / side effects
// ═══════════════════════════════════════════════════════════════

describe('accessibility', () => {
  const card = () => root.querySelector('.card')!;

  it('always exposes a dialog role and modal flag', async () => {
    dialog.showLoading();
    await update();

    expect(card().getAttribute('role')).toBe('dialog');
    expect(card().getAttribute('aria-modal')).toBe('true');
  });

  it('falls back to a static aria-label when nothing else names the dialog', async () => {
    dialog.showLoading();
    await update();

    expect(card().getAttribute('aria-label')).toBe('ダイアログ');
    expect(card().getAttribute('aria-labelledby')).toBeNull();
  });

  it('uses the configured fallback label', async () => {
    dialog.configure({ texts: { dialogAriaLabel: 'Dialog' } });
    dialog.showLoading();
    await update();

    expect(card().getAttribute('aria-label')).toBe('Dialog');
  });

  it('references the label nodes once something names the dialog', async () => {
    dialog.alert('保存しました');
    await update();

    expect(card().getAttribute('aria-labelledby')).toBe(
      'dialog-title dialog-step-label dialog-label'
    );
    expect(card().getAttribute('aria-label')).toBeNull();
  });

  it('is named by the current step when only the chrome has text', async () => {
    dialog.showSteps(['取得']);
    dialog.activateStep('取得');
    await update();

    expect(card().getAttribute('aria-label')).toBeNull();
    expect(text(root, '#dialog-step-label')).toBe('取得');
  });
});

describe('icons', () => {
  it.each(['success', 'error', 'warning', 'info'] as const)(
    'renders the %s alert icon',
    async (type) => {
      dialog.alert({ type, title: 'a' });
      await update();

      expect(root.querySelector('.body-inner svg')).not.toBeNull();
    }
  );

  it('renders the animated check for success', async () => {
    dialog.alert({ type: 'success', title: 'a' });
    await update();

    expect(root.querySelector('.check-mark')).not.toBeNull();
  });

  it('renders no icon when none is set', async () => {
    dialog.show({ type: 'loading' });
    await update();

    expect(root.querySelector('.icon-container')).toBeNull();
  });

  it('renders a distinct task icon per queue status', async () => {
    dialog.showQueue(['a', 'b', 'c', 'd']);
    dialog.activateQueue('a');
    dialog.completeQueue('b');
    dialog.failQueue('c');
    dialog.skipQueue('d');
    await update();

    const icons = [...root.querySelectorAll('.task-icon')];
    expect(icons).toHaveLength(4);
    // active はスピナー、それ以外は SVG
    expect(icons[0].querySelector('.mini-spinner')).not.toBeNull();
    expect(icons.slice(1).every((i) => i.querySelector('svg') !== null)).toBe(true);
  });

  it('renders a pending task icon', async () => {
    dialog.showQueue(['a']);
    await update();

    expect(root.querySelector('.task-item')!.getAttribute('data-status')).toBe('pending');
  });
});

describe('close animation', () => {
  it('keeps showing the last open content while fading out', async () => {
    dialog.alert({ type: 'success', title: 'さようなら' });
    await update();

    dialog.onConfirm();
    await update();

    // state はリセット済みだが、フェード中は直前の内容を描き続ける
    expect(dialog.state.dialogType).toBe('loading');
    expect(text(root, '#dialog-label')).toBe('さようなら');
    expect(root.querySelector('.card')!.hasAttribute('data-closing')).toBe(true);
  });

  it('marks the backdrop closed immediately', async () => {
    dialog.alert('a');
    await update();

    dialog.onConfirm();
    await update();

    expect(root.querySelector('.backdrop')!.hasAttribute('data-open')).toBe(false);
  });
});

describe('progress bar', () => {
  it('is transparent until a progress value is set', async () => {
    dialog.showLoading();
    await update();

    expect(root.querySelector<HTMLElement>('.progress-bar')!.style.opacity).toBe('0');
  });

  it('tracks the progress value', async () => {
    dialog.showLoading();
    dialog.setProgress(65);
    await update();

    const bar = root.querySelector<HTMLElement>('.progress-bar')!;
    expect(bar.style.width).toBe('65%');
    expect(bar.style.opacity).toBe('1');
  });
});

describe('side effects', () => {
  it('locks and restores body scroll', async () => {
    document.body.style.overflow = 'scroll';

    dialog.showLoading();
    await update();
    expect(document.body.style.overflow).toBe('hidden');

    dialog.hide();
    await update();
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('closes on Escape when allowed', async () => {
    const pending = dialog.confirm({ title: 'a', allowEscapeKey: true });
    await update();

    root
      .querySelector('.card')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    await expect(pending).resolves.toBe(false);
  });

  it('ignores Escape when disallowed', async () => {
    dialog.confirm({ title: 'a', allowEscapeKey: false });
    await update();

    root
      .querySelector('.card')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await update();

    expect(dialog.state.open).toBe(true);
  });

  it('closes on a backdrop click when allowed', async () => {
    const pending = dialog.alert({ title: 'a', allowOutsideClick: true });
    await update();

    root.querySelector('.backdrop')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await expect(pending).resolves.toMatchObject({ isCanceled: true });
  });

  it('ignores clicks that originate inside the card', async () => {
    dialog.alert({ title: 'a', allowOutsideClick: true });
    await update();

    root.querySelector('.card')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await update();

    expect(dialog.state.open).toBe(true);
  });

  it('guards page unload only while work is in flight', async () => {
    const unloadPrevented = () => {
      const e = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    };

    expect(unloadPrevented()).toBe(false);

    dialog.showLoading('処理中');
    await update();
    expect(unloadPrevented()).toBe(true);

    dialog.showQueue(['a']);
    await update();
    expect(unloadPrevented()).toBe(true);

    // 入力待ちは「処理中」ではない
    dialog.confirm('よろしいですか？');
    await update();
    expect(unloadPrevented()).toBe(false);

    dialog.hide();
    await update();
    expect(unloadPrevented()).toBe(false);
  });

  it('stops guarding unload once the element is removed', async () => {
    dialog.showLoading('処理中');
    await update();

    cleanup();

    const e = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it('moves focus onto the card when the dialog opens', async () => {
    dialog.alert('a');
    await update();

    expect(root.activeElement).toBe(root.querySelector('.card'));
  });

  it('returns focus to the previously focused element on close', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    dialog.alert('a');
    await update();
    dialog.onConfirm();
    await update();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('reclaims focus when the body is swapped', async () => {
    dialog.alert('a');
    await update();

    dialog.showQueue(['task']);
    await update();

    expect(root.activeElement).toBe(root.querySelector('.card'));
  });

  it('traps Tab inside the card', async () => {
    dialog.alert({ title: 'a', showCancelButton: true });
    await update();

    const card = root.querySelector('.card')!;
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    card.dispatchEvent(event);

    // カード内に focusable が無い/末尾にいる場合は既定動作を止めて巻き戻す
    expect(event.defaultPrevented).toBe(true);
  });

  it('ignores keydown once the dialog is closed', async () => {
    dialog.showLoading();
    await update();
    dialog.hide();
    await update();

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    root.querySelector('.card')!.dispatchEvent(event);

    expect(dialog.state.open).toBe(false);
  });

  it('stops observing the controller once disconnected', async () => {
    dialog.showLoading('a');
    await update();

    cleanup();
    dialog.setLabel('b');
    await update();

    expect(text(root, '#dialog-label')).toBe('a');
  });
});

// ═══════════════════════════════════════════════════════════════
// Width — インラインのカスタムプロパティで型別既定を上書きする
// ═══════════════════════════════════════════════════════════════

describe('width', () => {
  const cardWidth = (): string => {
    const card = root.querySelector<HTMLElement>('.card')!;
    return card.style.getPropertyValue('--dialog-width');
  };

  it('sets no inline width when none is specified', async () => {
    dialog.showLoading('読み込み中');
    await update();

    expect(cardWidth()).toBe('');
    // テーマ側の CSS 変数を潰さないよう、指定なしのときは style 属性ごと出さない
    expect(root.querySelector('.card')!.getAttribute('style')).toBeFalsy();
  });

  it('writes the resolved width as an inline custom property', async () => {
    dialog.show({ type: 'loading', width: 720 });
    await update();

    expect(cardWidth()).toBe('720px');
  });

  it('resolves tokens to the themeable CSS variable', async () => {
    dialog.alert({ title: 'wide', width: 'xl' });
    await update();

    expect(cardWidth()).toBe('var(--dialog-width-xl)');
  });

  it('overrides the type default (alert keeps its data-type)', async () => {
    dialog.alert({ title: 'wide', width: 'sm' });
    await update();

    const card = root.querySelector<HTMLElement>('.card')!;
    expect(card.dataset.type).toBe('alert');
    expect(card.style.getPropertyValue('--dialog-width')).toBe('var(--dialog-width-sm)');
  });

  it('drops the inline width when the next body omits it', async () => {
    dialog.alert({ title: 'wide', width: 'xl' });
    await update();
    expect(cardWidth()).toBe('var(--dialog-width-xl)');

    dialog.show({ type: 'loading' });
    await update();
    expect(cardWidth()).toBe('');
  });

  it('reflects setWidth() on the open dialog', async () => {
    dialog.showLoading('処理中');
    await update();

    dialog.setWidth('lg');
    await update();

    expect(cardWidth()).toBe('var(--dialog-width-lg)');
  });

  it('follows per-step widths in a wizard', async () => {
    dialog.showStepForm(
      [
        { key: 'a', label: 'A', schema: z.object({ x: z.string() }) },
        { key: 'b', label: 'B', schema: z.object({ y: z.string() }), width: 'xl' },
      ],
      { width: 'lg' }
    );
    await update();
    expect(cardWidth()).toBe('var(--dialog-width-lg)');

    dialog.updateFormField('x', 'ok');
    dialog.onStepNext();
    await update();

    expect(cardWidth()).toBe('var(--dialog-width-xl)');
  });

  it('keeps the width while the close animation plays', async () => {
    dialog.alert({ title: 'wide', width: 'xl' });
    await update();

    dialog.hide();
    await update();

    // 閉じアニメーション中は最後の open 状態を描き続けるので幅も保たれる
    expect(cardWidth()).toBe('var(--dialog-width-xl)');
  });
});

// ═══════════════════════════════════════════════════════════════
// ビューポート収容 — 本文がどれだけ伸びてもカードが画面外へはみ出さない
// ═══════════════════════════════════════════════════════════════

describe('viewport containment', () => {
  const styleText = (): string => overlayStyles.cssText.replace(/\s+/g, ' ');

  it('caps the card height against the backdrop instead of letting it grow', () => {
    // カードは常にビューポート (backdrop) の内側に収まる。
    expect(styleText()).toContain('max-height: var(--dialog-card-max-height)');
    expect(styleText()).toContain('--dialog-card-max-height: 100%');
  });

  it('makes .card-body the scroll region', () => {
    // はみ出した分はカード全体ではなく本文の中でスクロールさせる。
    expect(styleText()).toMatch(/\.card-body \{[^}]*overflow-y: auto/);
    expect(styleText()).toMatch(/\.card-body \{[^}]*min-height: 0/);
  });

  it('keeps alert actions pinned outside the scroll region', async () => {
    dialog.alert({ title: '確認', showCancelButton: true });
    await update();

    const actions = root.querySelector('.actions')!;
    expect(actions).not.toBeNull();
    expect(root.querySelector('.card')!.contains(actions)).toBe(true);
    expect(root.querySelector('.card-body')!.contains(actions)).toBe(false);
  });

  it('keeps form actions pinned outside the scroll region', async () => {
    dialog.form(z.object({ name: z.string().describe('名前') }), { title: '入力' });
    await update();

    const actions = root.querySelector('.actions')!;
    expect(actions).not.toBeNull();
    expect(root.querySelector('.card-body')!.contains(actions)).toBe(false);
    // 長いフォームでもボタンは常に見えるので、スクロールするのは本文だけ。
    expect(root.querySelector('.card-body')!.querySelector('.form-scroll-container')).not.toBeNull();
  });

  it('keeps step-form navigation pinned outside the scroll region', async () => {
    dialog.showStepForm([
      { key: 'a', label: 'A', schema: z.object({ name: z.string().describe('名前') }) },
      { key: 'b', label: 'B' },
    ]);
    await update();

    const actions = root.querySelector('.actions-step-form')!;
    expect(actions).not.toBeNull();
    expect(root.querySelector('.card-body')!.contains(actions)).toBe(false);
  });

  it('makes the scroll region keyboard reachable only while it overflows', async () => {
    dialog.showLoading('読み込み中');
    await update();

    const body = root.querySelector<HTMLElement>('.card-body')!;
    expect(body.hasAttribute('tabindex')).toBe(false);

    // happy-dom はレイアウトしないので、あふれた状態を寸法で作る。
    Object.defineProperty(body, 'scrollHeight', { value: 800, configurable: true });
    Object.defineProperty(body, 'clientHeight', { value: 300, configurable: true });
    dialog.setLabel('もう少しお待ちください');
    await update();

    expect(body.getAttribute('tabindex')).toBe('0');
    expect(body.hasAttribute('data-scrollable')).toBe(true);

    Object.defineProperty(body, 'scrollHeight', { value: 200, configurable: true });
    dialog.setLabel('完了間近');
    await update();

    expect(body.hasAttribute('tabindex')).toBe(false);
    expect(body.hasAttribute('data-scrollable')).toBe(false);
  });

  it('renders no footer for bodies without buttons', async () => {
    dialog.showLoading('読み込み中');
    await update();

    expect(root.querySelector('.card-footer')).toBeNull();
  });

  it('re-mounts the footer with the body so both re-animate together', async () => {
    dialog.alert({ title: 'a' });
    await update();
    const before = root.querySelector('.card-footer');
    expect(before).not.toBeNull();

    dialog.confirm('b');
    await update();

    expect(root.querySelector('.card-footer')).not.toBe(before);
  });
});
