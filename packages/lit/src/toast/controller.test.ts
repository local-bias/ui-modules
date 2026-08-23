import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastController } from './controller';

/** dismiss アニメーションが終わって DOM から消えるまでの猶予 (controller 内の定数と同じ) */
const DISMISS_ANIMATION_MS = 400;

let toast: ToastController;

beforeEach(() => {
  vi.useFakeTimers();
  toast = new ToastController();
});

afterEach(() => {
  vi.useRealTimers();
});

const ids = () => toast.state.items.map((i) => i.id);
const messages = () => toast.state.items.map((i) => i.message);

describe('show', () => {
  it('appends an item and returns its id', () => {
    const id = toast.show({ message: 'こんにちは' });

    expect(ids()).toEqual([id]);
    expect(toast.state.items[0]).toMatchObject({
      message: 'こんにちは',
      type: 'info',
      description: '',
      action: null,
      dismissing: false,
      paused: false,
    });
  });

  it('hands out unique ids', () => {
    expect(new Set([toast.show({ message: 'a' }), toast.show({ message: 'b' })]).size).toBe(2);
  });

  it('keeps newest at the end', () => {
    toast.show({ message: 'a' });
    toast.show({ message: 'b' });

    expect(messages()).toEqual(['a', 'b']);
  });

  it.each([
    ['success', (t: ToastController) => t.success('m')],
    ['error', (t: ToastController) => t.error('m')],
    ['warning', (t: ToastController) => t.warning('m')],
    ['info', (t: ToastController) => t.info('m')],
    ['loading', (t: ToastController) => t.loading('m')],
  ])('%s() sets the matching type', (type, call) => {
    call(toast);

    expect(toast.state.items[0].type).toBe(type);
  });

  it('carries description and action through', () => {
    const onClick = vi.fn();
    toast.info('削除しました', { description: '元に戻せます', action: { label: 'undo', onClick } });

    expect(toast.state.items[0]).toMatchObject({
      description: '元に戻せます',
      action: { label: 'undo' },
    });
  });

  it('defaults loading toasts to persistent', () => {
    toast.loading('アップロード中');

    expect(toast.state.items[0].duration).toBe(0);

    vi.advanceTimersByTime(60_000);
    expect(toast.state.items).toHaveLength(1);
  });

  it('lets loading take an explicit duration', () => {
    toast.loading('アップロード中', { duration: 1000 });

    expect(toast.state.items[0].duration).toBe(1000);
  });
});

describe('auto dismiss', () => {
  it('removes an item once its duration and animation elapse', () => {
    toast.success('保存しました', { duration: 1000 });

    vi.advanceTimersByTime(1000);
    expect(toast.state.items[0].dismissing).toBe(true);

    vi.advanceTimersByTime(DISMISS_ANIMATION_MS);
    expect(toast.state.items).toHaveLength(0);
  });

  it('uses the configured default duration', () => {
    toast.configure({ defaultDuration: 500 });
    toast.info('a');

    vi.advanceTimersByTime(500 + DISMISS_ANIMATION_MS);

    expect(toast.state.items).toHaveLength(0);
  });

  it('never auto-dismisses when duration is 0', () => {
    toast.show({ message: 'a', duration: 0 });

    vi.advanceTimersByTime(60_000);

    expect(toast.state.items).toHaveLength(1);
  });
});

describe('dismiss', () => {
  it('animates then removes a single toast', () => {
    const id = toast.info('a');

    toast.dismiss(id);
    expect(toast.state.items[0].dismissing).toBe(true);

    vi.advanceTimersByTime(DISMISS_ANIMATION_MS);
    expect(toast.state.items).toHaveLength(0);
  });

  it('ignores an unknown id', () => {
    toast.info('a');

    toast.dismiss('nope');

    expect(toast.state.items[0].dismissing).toBe(false);
  });

  it('is idempotent', () => {
    const id = toast.info('a');

    toast.dismiss(id);
    toast.dismiss(id);
    vi.advanceTimersByTime(DISMISS_ANIMATION_MS);

    expect(toast.state.items).toHaveLength(0);
  });

  it('dismissAll clears everything currently shown', () => {
    toast.info('a');
    toast.info('b');

    toast.dismissAll();
    expect(toast.state.items.every((i) => i.dismissing)).toBe(true);

    vi.advanceTimersByTime(DISMISS_ANIMATION_MS);
    expect(toast.state.items).toHaveLength(0);
  });

  it('dismissAll does not swallow a toast shown during the animation', () => {
    toast.info('old');
    toast.dismissAll();

    vi.advanceTimersByTime(DISMISS_ANIMATION_MS / 2);
    toast.info('new');
    vi.advanceTimersByTime(DISMISS_ANIMATION_MS);

    expect(messages()).toEqual(['new']);
  });
});

describe('update', () => {
  it('patches the message and type in place', () => {
    const id = toast.loading('アップロード中');

    toast.update(id, { type: 'success', message: '完了' });

    expect(toast.state.items[0]).toMatchObject({ id, type: 'success', message: '完了' });
  });

  it('starts the default timer when leaving loading', () => {
    toast.configure({ defaultDuration: 2000 });
    const id = toast.loading('アップロード中');

    toast.update(id, { type: 'success', message: '完了' });

    expect(toast.state.items[0].duration).toBe(2000);
    vi.advanceTimersByTime(2000 + DISMISS_ANIMATION_MS);
    expect(toast.state.items).toHaveLength(0);
  });

  it('honours an explicit duration on the transition', () => {
    const id = toast.loading('アップロード中');

    toast.update(id, { type: 'error', message: '失敗', duration: 0 });

    vi.advanceTimersByTime(60_000);
    expect(toast.state.items).toHaveLength(1);
  });

  it('resets a running timer when duration is given', () => {
    const id = toast.info('a', { duration: 1000 });

    vi.advanceTimersByTime(900);
    toast.update(id, { duration: 1000 });
    vi.advanceTimersByTime(500);

    expect(toast.state.items[0].dismissing).toBe(false);
  });

  it('leaves the timer alone for a plain content patch', () => {
    const id = toast.info('a', { duration: 1000 });

    vi.advanceTimersByTime(600);
    toast.update(id, { message: 'b' });
    vi.advanceTimersByTime(400);

    expect(toast.state.items[0].dismissing).toBe(true);
  });

  it('ignores unknown and already-dismissing toasts', () => {
    const id = toast.info('a');
    toast.update('nope', { message: 'x' });
    toast.dismiss(id);

    toast.update(id, { message: 'changed' });

    expect(toast.state.items[0].message).toBe('a');
  });
});

describe('pause and resume', () => {
  it('pauses the countdown and banks the remaining time', () => {
    const id = toast.info('a', { duration: 1000 });

    vi.advanceTimersByTime(400);
    toast.pauseTimer(id);

    expect(toast.state.items[0].paused).toBe(true);
    expect(toast.state.items[0].remainingMs).toBe(600);

    vi.advanceTimersByTime(5000);
    expect(toast.state.items[0].dismissing).toBe(false);
  });

  it('resumes from the banked remaining time', () => {
    const id = toast.info('a', { duration: 1000 });
    vi.advanceTimersByTime(400);
    toast.pauseTimer(id);

    toast.resumeTimer(id);
    expect(toast.state.items[0].paused).toBe(false);

    vi.advanceTimersByTime(599);
    expect(toast.state.items[0].dismissing).toBe(false);

    vi.advanceTimersByTime(1);
    expect(toast.state.items[0].dismissing).toBe(true);
  });

  it('ignores pause/resume for persistent toasts', () => {
    const id = toast.loading('a');

    toast.pauseTimer(id);
    expect(toast.state.items[0].paused).toBe(false);

    toast.resumeTimer(id);
    expect(toast.state.items[0].paused).toBe(false);
  });

  it('ignores pause/resume for unknown ids', () => {
    expect(() => {
      toast.pauseTimer('nope');
      toast.resumeTimer('nope');
    }).not.toThrow();
  });

  it('ignores a redundant pause or resume', () => {
    const id = toast.info('a', { duration: 1000 });

    toast.resumeTimer(id); // まだ pause していない
    expect(toast.state.items[0].paused).toBe(false);

    toast.pauseTimer(id);
    toast.pauseTimer(id);
    expect(toast.state.items[0].remainingMs).toBe(1000);
  });
});

describe('maxVisible', () => {
  it('dismisses the oldest toast beyond the limit', () => {
    toast.configure({ maxVisible: 2 });

    toast.info('a');
    toast.info('b');
    toast.info('c');

    expect(toast.state.items.find((i) => i.message === 'a')!.dismissing).toBe(true);
    vi.advanceTimersByTime(DISMISS_ANIMATION_MS);
    expect(messages()).toEqual(['b', 'c']);
  });

  it('defaults to three visible toasts', () => {
    for (const m of ['a', 'b', 'c', 'd']) toast.info(m);

    vi.advanceTimersByTime(DISMISS_ANIMATION_MS);
    expect(messages()).toEqual(['b', 'c', 'd']);
  });
});

describe('configure', () => {
  it('sets position, maxVisible and defaultDuration', () => {
    toast.configure({ position: 'top-left', maxVisible: 5, defaultDuration: 1234 });

    expect(toast.state).toMatchObject({
      position: 'top-left',
      maxVisible: 5,
      defaultDuration: 1234,
    });
  });

  it('leaves unspecified settings untouched', () => {
    const before = { ...toast.state };

    toast.configure({ position: 'top-center' });

    expect(toast.state.maxVisible).toBe(before.maxVisible);
    expect(toast.state.defaultDuration).toBe(before.defaultDuration);
  });

  it('merges text overrides', () => {
    toast.configure({ texts: { closeLabel: 'Close' } });

    expect(toast.texts.closeLabel).toBe('Close');
    expect(toast.texts.regionLabel).toBe(new ToastController().texts.regionLabel);
  });
});

describe('subscribe', () => {
  it('notifies on every change with a fresh snapshot', () => {
    const seen: number[] = [];
    toast.subscribe((s) => seen.push(s.items.length));

    const id = toast.info('a');
    toast.dismiss(id);
    vi.advanceTimersByTime(DISMISS_ANIMATION_MS);

    expect(seen).toEqual([1, 1, 0]);
  });

  it('copies the items array so listeners cannot observe later mutations', () => {
    let snapshot: { items: unknown[] } | undefined;
    toast.subscribe((s) => (snapshot = s));

    toast.info('a');
    const captured = snapshot!.items;
    toast.info('b');

    expect(captured).toHaveLength(1);
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = toast.subscribe(listener);

    toast.info('a');
    unsubscribe();
    toast.info('b');

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
