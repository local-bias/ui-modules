/**
 * `document.body` のスクロールロック。
 *
 * ロック対象は body という *グローバル* な資源なのに、`<overlay-dialog>` は同時に
 * 複数存在しうる (シングルトンの `dialog` と `new DialogController()` の独自
 * インスタンスの併用、同じコントローラーを自前でテンプレートに置いた場合など)。
 *
 * 各要素が自前で「元の overflow」を覚えると、2つ目の要素が1つ目のロック値
 * ('hidden') を「元の値」として保存してしまい、閉じたあとに 'hidden' が復元されて
 * ページが二度とスクロールできなくなる。しかも次に開いた要素がその 'hidden' を
 * また「元の値」として保存するので、以降の開閉では自然に治らない。
 *
 * そこで所有者を数え、最初の acquire と最後の release だけが body に触る。
 */

let lockCount = 0;
/** 最初の acquire 時点の `body.style.overflow`。誰もロックしていない間は null。 */
let savedOverflow: string | null = null;

export function acquireScrollLock(): void {
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount++;
}

export function releaseScrollLock(): void {
  // 二重解放でカウントが負に沈むと、以降の release が効かなくなる。
  if (lockCount === 0) return;
  lockCount--;
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow ?? '';
    savedOverflow = null;
  }
}

/** 現在のロック保持数 (テスト用)。 */
export function scrollLockCount(): number {
  return lockCount;
}
