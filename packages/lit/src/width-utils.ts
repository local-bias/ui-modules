import type { DialogWidth, DialogWidthToken } from './types';

/**
 * トークンは実値ではなく CSS 変数への参照に解決する。
 * こうしておくと `dialog.alert({ width: 'lg' })` の実寸をテーマ側
 * (`--dialog-width-lg`) から後づけで再調整できる。
 *
 * Map なのは、`'constructor'` や `'toString'` のような Object.prototype 由来の
 * キーがトークンとして引けてしまうのを防ぐため。
 */
const TOKEN_VARS = new Map<DialogWidthToken, string>([
  ['sm', 'var(--dialog-width-sm)'],
  ['md', 'var(--dialog-width-md)'],
  ['lg', 'var(--dialog-width-lg)'],
  ['xl', 'var(--dialog-width-xl)'],
  ['full', 'var(--dialog-width-full)'],
]);

/** 正の CSS 長さ。負値は幅として無意味なので通さない。 */
const LENGTH_RE = /^(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|ch|%|vw|vh|vmin|vmax|pt)$/;

/** エスケープハッチとして通す CSS 関数。 */
const FUNCTION_HEAD_RE = /^(?:min|max|clamp|calc|var)\(/;

/**
 * 値に許す文字。`;` `{` `}` `"` `'` `\` `:` `<` `>` `@` を含む値はここで落ちる。
 * 実際の埋め込みは `style.setProperty()` 経由 (= CSSOM が値を1つとして扱う) なので
 * 宣言の外に漏れることはないが、そもそも受け取らない方針で二重に塞いでおく。
 */
const SAFE_CHARS_RE = /^[a-zA-Z0-9\s.,%()+*/_-]+$/;

/** 外部リソースを引かせないための明示的な拒否。 */
const URL_RE = /url\s*\(/i;

function isBalanced(value: string): boolean {
  let depth = 0;
  for (const char of value) {
    if (char === '(') depth++;
    else if (char === ')') {
      depth--;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

function warnInvalid(value: unknown): null {
  console.warn(
    `[@konomi-app/ui] Invalid dialog width: ${JSON.stringify(value)} — ` +
      'falling back to the default width for this dialog type.'
  );
  return null;
}

function resolveString(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return warnInvalid(value);
  if (!SAFE_CHARS_RE.test(trimmed) || URL_RE.test(trimmed)) return warnInvalid(value);
  if (LENGTH_RE.test(trimmed)) return trimmed;
  if (FUNCTION_HEAD_RE.test(trimmed) && trimmed.endsWith(')') && isBalanced(trimmed)) {
    return trimmed;
  }
  return warnInvalid(value);
}

/**
 * 呼び出し側の `width` 指定を、`.card` にインラインで載せる CSS 値へ解決する。
 * `null` は「指定なし」= type ごとの既定幅にフォールバックする意味を持つ。
 * 不正値は握り潰さず警告してから `null` に倒す。
 */
export function resolveDialogWidth(width: DialogWidth | null | undefined): string | null {
  if (width == null) return null;

  if (typeof width === 'number') {
    if (!Number.isFinite(width) || width <= 0) return warnInvalid(width);
    // 1e21 のように指数表記へ丸められる値は CSS の長さとして成立しない。
    const px = `${width}px`;
    if (!LENGTH_RE.test(px)) return warnInvalid(width);
    return px;
  }

  if (typeof width !== 'string') return warnInvalid(width);

  const token = TOKEN_VARS.get(width as DialogWidthToken);
  if (token) return token;

  return resolveString(width);
}
