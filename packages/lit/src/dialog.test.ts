import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { dialog } from './dialog';
import { stepStatuses } from './test-utils';

/** シングルトンなのでテスト間で状態を持ち越さないよう毎回閉じる。 */
beforeEach(() => dialog.hide());

afterEach(() => {
  dialog.hide();
  document.querySelectorAll('overlay-dialog').forEach((el) => el.remove());
  document.body.style.overflow = '';
});

describe('element lifecycle', () => {
  it('lazily appends a single <overlay-dialog> to the body', () => {
    expect(document.querySelectorAll('overlay-dialog')).toHaveLength(0);

    dialog.showLoading('a');
    dialog.alert('b');
    dialog.showQueue(['c']);

    expect(document.querySelectorAll('overlay-dialog')).toHaveLength(1);
  });

  it('re-creates the element if it was removed from the DOM', () => {
    dialog.showLoading('a');
    document.querySelector('overlay-dialog')!.remove();

    dialog.showLoading('b');

    expect(document.querySelectorAll('overlay-dialog')).toHaveLength(1);
  });

  it('wires the shared controller into the element', () => {
    dialog.showLoading('a');

    const el = document.querySelector('overlay-dialog') as HTMLElement & { controller: unknown };
    expect(el.controller).toBe(dialog.controller);
  });
});

describe('delegation to the controller', () => {
  it('forwards the steps chrome API', () => {
    dialog.showSteps(['a', 'b'], { title: '同期' });
    dialog.activateStep('a');
    dialog.completeStep('a');
    dialog.activateStep('b');
    dialog.skipStep('b');

    expect(stepStatuses(dialog.controller.state.steps)).toBe('a:done b:skipped');
    expect(dialog.controller.state.title).toBe('同期');

    dialog.setStepItems(['x']);
    expect(stepStatuses(dialog.controller.state.steps)).toBe('x:pending');

    dialog.failStep('x');
    expect(dialog.controller.state.steps[0].status).toBe('error');

    dialog.clearSteps();
    expect(dialog.controller.state.steps).toHaveLength(0);
  });

  it('forwards the queue API', () => {
    dialog.showQueue(['a', 'b'], 'アップロード');
    dialog.activateQueue('a');
    dialog.completeQueue('a');
    dialog.skipQueue('b');

    expect(dialog.controller.state.queues.map((q) => q.status)).toEqual(['done', 'skipped']);
    expect(dialog.controller.state.title).toBe('アップロード');

    dialog.setQueueItems(['c']);
    dialog.failQueue('c');
    expect(dialog.controller.state.queues[0].status).toBe('error');

    dialog.clearQueue();
    expect(dialog.controller.state.queues).toHaveLength(0);
  });

  it('forwards the loading helpers', () => {
    dialog.showLoading('読み込み中');
    dialog.setProgress(40);
    dialog.setLabel('もう少し');
    dialog.setDescription('お待ちください');
    dialog.setHtml('<b>x</b>');
    dialog.setTitle('タイトル');

    expect(dialog.controller.state).toMatchObject({
      progress: 40,
      label: 'もう少し',
      description: 'お待ちください',
      html: '<b>x</b>',
      title: 'タイトル',
    });
  });

  it('forwards alert and confirm results', async () => {
    const alerted = dialog.alert('保存しました');
    dialog.controller.onConfirm();
    await expect(alerted).resolves.toMatchObject({ isConfirmed: true });

    const confirmed = dialog.confirm('削除しますか？');
    dialog.controller.onConfirm();
    await expect(confirmed).resolves.toBe(true);
  });

  it('forwards the form API including field updates', async () => {
    const pending = dialog.form(z.object({ name: z.string().min(1) }), { title: '登録' });

    dialog.touchFormField('name');
    expect(dialog.controller.state.formErrors.name).toBeTruthy();

    dialog.updateFormField('name', '花子');
    dialog.controller.onConfirm();

    await expect(pending).resolves.toEqual({ name: '花子' });
  });

  it('forwards the wizard API including navigation', async () => {
    const pending = dialog.showStepForm(
      [
        { key: 'a', label: 'A', schema: z.object({ x: z.string().min(1) }) },
        { key: 'b', label: 'B', schema: z.object({ y: z.string().min(1) }) },
      ],
      { title: 'ウィザード' }
    );

    dialog.updateFormField('x', '1');
    dialog.onStepNext();
    expect(dialog.controller.state.stepIndex).toBe(1);

    dialog.onStepPrev();
    expect(dialog.controller.state.stepIndex).toBe(0);

    dialog.onStepNext();
    dialog.updateFormField('y', '2');
    dialog.onStepNext();

    await expect(pending).resolves.toEqual({ a: { x: '1' }, b: { y: '2' } });
  });

  it('forwards configure', () => {
    dialog.configure({ texts: { confirmButtonText: 'Yes' } });
    dialog.confirm('a');

    expect(dialog.controller.state.confirmButtonText).toBe('Yes');

    // 後続テストに漏らさないよう戻す
    dialog.configure({ texts: { confirmButtonText: 'OK' } });
  });

  it('forwards show and hide', () => {
    dialog.show({ type: 'loading', label: 'x' });
    expect(dialog.controller.state.open).toBe(true);

    dialog.hide();
    expect(dialog.controller.state.open).toBe(false);
  });
});

describe('width delegation', () => {
  it('forwards setWidth() to the controller', () => {
    dialog.showLoading('a');
    dialog.setWidth('lg');

    expect(dialog.controller.state.width).toBe('var(--dialog-width-lg)');
  });

  it('creates the element before applying a width-bearing dialog', () => {
    dialog.alert({ title: 'a', width: 'xl' });

    expect(document.querySelectorAll('overlay-dialog')).toHaveLength(1);
    expect(dialog.controller.state.width).toBe('var(--dialog-width-xl)');
  });
});
