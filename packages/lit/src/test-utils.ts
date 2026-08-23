import type { DialogController } from './controller';
import type { OverlayDialog } from './overlay-dialog';
import type { StepItem } from './types';

/** `key:status key:status ...` の形に潰して、ステップ状態をまとめて検証しやすくする。 */
export function stepStatuses(items: StepItem[]): string {
  return items.map((s) => `${s.key}:${s.status}`).join(' ');
}

/** `<overlay-dialog>` を DOM に挿し、テスト終了時に片付けるためのハンドルを返す。 */
export async function mountDialog(controller: DialogController): Promise<{
  el: OverlayDialog;
  root: ShadowRoot;
  /** 再描画を待ってから Shadow DOM を問い合わせる。 */
  update: () => Promise<ShadowRoot>;
  cleanup: () => void;
}> {
  await import('./overlay-dialog');
  const el = document.createElement('overlay-dialog') as OverlayDialog;
  el.controller = controller;
  document.body.appendChild(el);
  await el.updateComplete;

  const root = el.renderRoot as ShadowRoot;
  return {
    el,
    root,
    update: async () => {
      await el.updateComplete;
      return el.renderRoot as ShadowRoot;
    },
    cleanup: () => el.remove(),
  };
}

/** Shadow DOM 内のテキストを取得する (存在しなければ null)。 */
export function text(root: ShadowRoot, selector: string): string | null {
  return root.querySelector(selector)?.textContent?.trim() ?? null;
}
