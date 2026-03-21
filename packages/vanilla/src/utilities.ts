import { LoadingOverlay } from './loading-overlay';

/**
 * 指定された関数をラップし、実行中にローディングオーバーレイを表示する高階関数。
 *
 * @template T - 任意の引数を取り、任意の値を返す関数の型。
 * @param {T} fn - 実行する関数。
 * @param {string} [label='Loading...'] - ローディングオーバーレイに表示するラベル。デフォルトは 'Loading...'。
 * @returns {(...args: Parameters<T>) => Promise<ReturnType<T>>} - ラップされた関数。実行中にローディングオーバーレイを表示し、完了後に非表示にする。
 */
export const withLoading = <T extends (...args: any[]) => any>(
  fn: T,
  label: string = 'Loading...'
) => {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const overlay = new LoadingOverlay({ label });
    overlay.show();
    try {
      return await fn(...args);
    } finally {
      overlay.hide();
    }
  };
};
