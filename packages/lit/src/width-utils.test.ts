import { describe, expect, it, vi, afterEach } from 'vitest';
import { resolveDialogWidth } from './width-utils';

afterEach(() => {
  vi.restoreAllMocks();
});

/** console.warn を握り潰しつつ、呼ばれた回数を数える。 */
function spyWarn() {
  return vi.spyOn(console, 'warn').mockImplementation(() => {});
}

describe('resolveDialogWidth', () => {
  describe('未指定', () => {
    it('undefined は null (= type 既定にフォールバック)', () => {
      expect(resolveDialogWidth(undefined)).toBeNull();
    });

    it('null は null', () => {
      expect(resolveDialogWidth(null)).toBeNull();
    });
  });

  describe('トークン', () => {
    it.each([
      ['sm', 'var(--dialog-width-sm)'],
      ['md', 'var(--dialog-width-md)'],
      ['lg', 'var(--dialog-width-lg)'],
      ['xl', 'var(--dialog-width-xl)'],
      ['full', 'var(--dialog-width-full)'],
    ])('%s → %s', (token, expected) => {
      expect(resolveDialogWidth(token as never)).toBe(expected);
    });

    it('トークンは CSS 変数参照に解決されるので、テーマ側で再調整できる', () => {
      // 実値ではなく var() を返すことがテーマ再調整の前提になっている
      expect(resolveDialogWidth('lg')).toContain('var(');
    });
  });

  describe('数値', () => {
    it('px として解釈する', () => {
      expect(resolveDialogWidth(720)).toBe('720px');
    });

    it('小数も通る', () => {
      expect(resolveDialogWidth(400.5)).toBe('400.5px');
    });

    it('0 以下は不正値として警告し null にフォールバックする', () => {
      const warn = spyWarn();
      expect(resolveDialogWidth(0)).toBeNull();
      expect(resolveDialogWidth(-100)).toBeNull();
      expect(warn).toHaveBeenCalledTimes(2);
    });

    it('指数表記になる巨大な数値は不正値 (CSS の長さとして成立しないため)', () => {
      spyWarn();
      expect(resolveDialogWidth(1e21)).toBeNull();
    });

    it('NaN / Infinity は不正値', () => {
      spyWarn();
      expect(resolveDialogWidth(Number.NaN)).toBeNull();
      expect(resolveDialogWidth(Number.POSITIVE_INFINITY)).toBeNull();
    });
  });

  describe('CSS 長さ文字列', () => {
    it.each(['400px', '30rem', '2.5em', '80%', '50vw', '90vmin', '40ch'])('%s は通る', (value) => {
      expect(resolveDialogWidth(value)).toBe(value);
    });

    it('前後の空白は落とす', () => {
      expect(resolveDialogWidth('  480px  ')).toBe('480px');
    });

    it('単位なしの数値文字列は不正値 (CSS として width に使えないため)', () => {
      const warn = spyWarn();
      expect(resolveDialogWidth('400')).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('空文字は不正値', () => {
      spyWarn();
      expect(resolveDialogWidth('')).toBeNull();
      expect(resolveDialogWidth('   ')).toBeNull();
    });
  });

  describe('CSS 関数 (エスケープハッチ)', () => {
    it.each([
      'clamp(320px, 60vw, 720px)',
      'min(90vw, 640px)',
      'max(400px, 50%)',
      'calc(100% - 40px)',
      'var(--my-width)',
    ])('%s は通る', (value) => {
      expect(resolveDialogWidth(value)).toBe(value);
    });

    it('括弧が閉じていない値は不正値', () => {
      spyWarn();
      expect(resolveDialogWidth('clamp(320px, 60vw')).toBeNull();
    });

    it('閉じ括弧が余る値は不正値', () => {
      spyWarn();
      expect(resolveDialogWidth('min(90vw))')).toBeNull();
    });

    it('許可していない関数は不正値', () => {
      spyWarn();
      expect(resolveDialogWidth('attr(data-w)')).toBeNull();
    });
  });

  describe('CSS インジェクション対策', () => {
    it.each([
      '400px; background: red',
      '400px} .card{display:none',
      '400px /* comment */',
      'url(http://evil.example.com)',
      'min(90vw, url(x))',
      '400px"',
      "400px'",
      '400px\\',
      'expression(alert(1))',
    ])('%j は拒否する', (value) => {
      spyWarn();
      expect(resolveDialogWidth(value)).toBeNull();
    });

    it('拒否時は値をそのまま埋め込まず、警告してフォールバックする', () => {
      const warn = spyWarn();
      resolveDialogWidth('400px; background: red');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain('width');
    });
  });

  describe('トークン表の取り違え', () => {
    it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__'])(
      'Object.prototype 由来の %s はトークンとして扱わない',
      (value) => {
        spyWarn();
        expect(resolveDialogWidth(value)).toBeNull();
      }
    );
  });

  describe('その他の型', () => {
    it('オブジェクトや真偽値は不正値', () => {
      spyWarn();
      expect(resolveDialogWidth({} as never)).toBeNull();
      expect(resolveDialogWidth(true as never)).toBeNull();
    });
  });
});
