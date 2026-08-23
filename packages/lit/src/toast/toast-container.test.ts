import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastController } from './controller';
import { toast } from './toast';
import type { ToastContainer } from './toast-container';
import './toast-container';

let controller: ToastController;
let el: ToastContainer;
let root: ShadowRoot;

async function update(): Promise<ShadowRoot> {
  await el.updateComplete;
  return el.renderRoot as ShadowRoot;
}

beforeEach(async () => {
  controller = new ToastController();
  el = document.createElement('toast-container') as ToastContainer;
  el.controller = controller;
  document.body.appendChild(el);
  await el.updateComplete;
  root = el.renderRoot as ShadowRoot;
});

afterEach(() => {
  el.remove();
  document.querySelectorAll('toast-container').forEach((n) => n.remove());
});

describe('rendering', () => {
  it('renders nothing but the region when empty', async () => {
    expect(root.querySelector('.container')).not.toBeNull();
    expect(root.querySelectorAll('.toast-card')).toHaveLength(0);
  });

  it('renders one card per toast in order', async () => {
    controller.info('a');
    controller.info('b');
    await update();

    expect([...root.querySelectorAll('.toast-message')].map((n) => n.textContent)).toEqual([
      'a',
      'b',
    ]);
  });

  it('tags the card with its type', async () => {
    controller.success('a');
    await update();

    expect(root.querySelector('.toast-card')!.getAttribute('data-type')).toBe('success');
  });

  it('renders a description when present', async () => {
    controller.info('a', { description: '詳細' });
    await update();

    expect(root.querySelector('.toast-description')!.textContent).toBe('詳細');
    expect(root.querySelector('.toast-message')!.hasAttribute('data-titled')).toBe(true);
  });

  it('renders a spinner for loading toasts', async () => {
    controller.loading('アップロード中');
    await update();

    expect(root.querySelector('.toast-spinner')).not.toBeNull();
  });

  it('shows the timer ring only for auto-dismissing, non-loading toasts', async () => {
    controller.info('timed', { duration: 1000 });
    controller.info('persistent', { duration: 0 });
    controller.loading('loading');
    await update();

    const ringByType = [...root.querySelectorAll('.toast-card')].map((card) => [
      card.getAttribute('data-type'),
      card.querySelector('.toast-timer-ring') !== null,
    ]);

    expect(ringByType).toEqual([
      ['info', true],
      ['info', false],
      ['loading', false],
    ]);
  });

  it('reuses the card node when only the content changes', async () => {
    const id = controller.loading('アップロード中');
    await update();
    const before = root.querySelector('.toast-card');

    controller.update(id, { type: 'success', message: '完了' });
    await update();

    expect(root.querySelector('.toast-card')).toBe(before);
    expect(root.querySelector('.toast-message')!.textContent).toBe('完了');
  });
});

describe('interaction', () => {
  it('dismisses via the close button', async () => {
    controller.info('a');
    await update();

    root.querySelector<HTMLButtonElement>('.toast-close')!.click();

    expect(controller.state.items[0].dismissing).toBe(true);
  });

  it('runs the action and dismisses', async () => {
    const onClick = vi.fn();
    controller.info('削除しました', { action: { label: '元に戻す', onClick } });
    await update();

    root.querySelector<HTMLButtonElement>('.toast-action-btn')!.click();

    expect(onClick).toHaveBeenCalledOnce();
    expect(controller.state.items[0].dismissing).toBe(true);
  });

  it('pauses on hover and resumes on leave', async () => {
    controller.info('a', { duration: 1000 });
    await update();
    const card = root.querySelector('.toast-card')!;

    card.dispatchEvent(new MouseEvent('mouseenter'));
    expect(controller.state.items[0].paused).toBe(true);

    card.dispatchEvent(new MouseEvent('mouseleave'));
    expect(controller.state.items[0].paused).toBe(false);
  });
});

describe('accessibility', () => {
  it('labels the region', async () => {
    expect(root.querySelector('.container')!.getAttribute('role')).toBe('region');
    expect(root.querySelector('.container')!.getAttribute('aria-label')).toBe(
      controller.texts.regionLabel
    );
  });

  it('uses role=alert for errors and role=status otherwise', async () => {
    controller.error('失敗');
    controller.success('成功');
    await update();

    expect([...root.querySelectorAll('.toast-card')].map((c) => c.getAttribute('role'))).toEqual([
      'alert',
      'status',
    ]);
  });

  it('labels the close button', async () => {
    controller.configure({ texts: { closeLabel: 'Close' } });
    controller.info('a');
    await update();

    expect(root.querySelector('.toast-close')!.getAttribute('aria-label')).toBe('Close');
  });

  it('reflects the configured position', async () => {
    controller.configure({ position: 'top-left' });
    await update();

    expect(root.querySelector('.container')!.getAttribute('data-position')).toBe('top-left');
  });
});

describe('toast singleton', () => {
  afterEach(() => {
    toast.dismissAll();
    document.querySelectorAll('toast-container').forEach((n) => n.remove());
  });

  it('lazily mounts a single container', () => {
    const before = document.querySelectorAll('toast-container').length;

    toast.success('a');
    toast.error('b');

    expect(document.querySelectorAll('toast-container').length).toBe(before + 1);
  });

  it('forwards every show helper to the controller', () => {
    // maxVisible / 直前テストの残骸に左右されないよう、返された id で引く
    toast.configure({ maxVisible: 100 });
    const created = [
      toast.success('s'),
      toast.error('e'),
      toast.warning('w'),
      toast.info('i'),
      toast.loading('l'),
      toast.show({ message: 'x', type: 'info' }),
    ];

    const byId = new Map(toast.controller.state.items.map((t) => [t.id, t]));
    expect(created.map((id) => byId.get(id)?.type)).toEqual([
      'success',
      'error',
      'warning',
      'info',
      'loading',
      'info',
    ]);
  });

  it('forwards dismiss, update and configure', () => {
    toast.configure({ maxVisible: 10 });
    const id = toast.loading('a');

    toast.update(id, { message: 'b', duration: 0 });
    expect(toast.controller.state.items.find((t) => t.id === id)!.message).toBe('b');

    toast.dismiss(id);
    expect(toast.controller.state.items.find((t) => t.id === id)!.dismissing).toBe(true);
  });
});
