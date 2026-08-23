import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFocusableElements, trapTabFocus } from './focus-trap';

/**
 * `getFocusableElements` は `offsetParent !== null` で可視判定する。
 * happy-dom はレイアウトを持たず常に null を返すので、可視要素を明示的に作る。
 */
function visible<T extends HTMLElement>(el: T): T {
  Object.defineProperty(el, 'offsetParent', { value: document.body, configurable: true });
  return el;
}

function hidden<T extends HTMLElement>(el: T): T {
  Object.defineProperty(el, 'offsetParent', { value: null, configurable: true });
  return el;
}

function container(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  el.querySelectorAll<HTMLElement>('*').forEach(visible);
  return el;
}

function tab(shiftKey = false): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true });
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('getFocusableElements', () => {
  it('collects the standard focusable elements in document order', () => {
    const el = container(`
      <a href="#one">a</a>
      <button>b</button>
      <input />
      <select></select>
      <textarea></textarea>
      <div tabindex="0">d</div>
    `);

    expect(getFocusableElements(el).map((n) => n.tagName)).toEqual([
      'A',
      'BUTTON',
      'INPUT',
      'SELECT',
      'TEXTAREA',
      'DIV',
    ]);
  });

  it('excludes disabled controls', () => {
    const el = container('<button disabled>a</button><input disabled /><button>b</button>');

    expect(getFocusableElements(el)).toHaveLength(1);
  });

  it('excludes tabindex="-1"', () => {
    const el = container('<div tabindex="-1">a</div><div tabindex="0">b</div>');

    expect(getFocusableElements(el)).toHaveLength(1);
  });

  it('excludes anchors without href', () => {
    const el = container('<a>a</a><a href="#x">b</a>');

    expect(getFocusableElements(el)).toHaveLength(1);
  });

  it('excludes elements that are not laid out', () => {
    const el = container('<button>a</button><button>b</button>');
    hidden(el.querySelectorAll('button')[0]);

    expect(getFocusableElements(el)).toHaveLength(1);
  });
});

describe('trapTabFocus', () => {
  it('falls back when the container has nothing focusable', () => {
    const el = container('<p>text only</p>');
    const fallback = vi.fn();
    const event = tab();

    trapTabFocus(event, el, null, fallback);

    expect(fallback).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('wraps from the last element back to the first on Tab', () => {
    const el = container('<button id="first">a</button><button id="last">b</button>');
    const [first, last] = getFocusableElements(el);
    const focus = vi.spyOn(first, 'focus');
    const event = tab();

    trapTabFocus(event, el, last, () => {});

    expect(focus).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('wraps from the first element back to the last on Shift+Tab', () => {
    const el = container('<button id="first">a</button><button id="last">b</button>');
    const [first, last] = getFocusableElements(el);
    const focus = vi.spyOn(last, 'focus');
    const event = tab(true);

    trapTabFocus(event, el, first, () => {});

    expect(focus).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('lets the browser handle Tab in the middle of the list', () => {
    const el = container('<button>a</button><button>b</button><button>c</button>');
    const middle = getFocusableElements(el)[1];
    const event = tab();

    trapTabFocus(event, el, middle, () => {});

    expect(event.defaultPrevented).toBe(false);
  });

  it('pulls focus to the first element when nothing inside is focused', () => {
    const el = container('<button>a</button><button>b</button>');
    const first = getFocusableElements(el)[0];
    const focus = vi.spyOn(first, 'focus');

    trapTabFocus(tab(), el, null, () => {});

    expect(focus).toHaveBeenCalledOnce();
  });

  it('pulls focus to the last element on Shift+Tab when nothing is focused', () => {
    const el = container('<button>a</button><button>b</button>');
    const last = getFocusableElements(el)[1];
    const focus = vi.spyOn(last, 'focus');

    trapTabFocus(tab(true), el, null, () => {});

    expect(focus).toHaveBeenCalledOnce();
  });

  it('keeps a single focusable element focused in both directions', () => {
    const el = container('<button>only</button>');
    const only = getFocusableElements(el)[0];
    const focus = vi.spyOn(only, 'focus');

    trapTabFocus(tab(), el, only, () => {});
    trapTabFocus(tab(true), el, only, () => {});

    expect(focus).toHaveBeenCalledTimes(2);
  });
});
