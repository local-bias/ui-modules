import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DialogController } from './controller';
import { acquireScrollLock, releaseScrollLock, scrollLockCount } from './scroll-lock';
import { mountDialog } from './test-utils';
import './overlay-dialog';

const overflow = () => document.body.style.overflow;

beforeEach(() => {
  document.body.style.overflow = '';
});

afterEach(() => {
  // どのケースを抜けてもロックは誰にも保持されていないこと。ここが 0 でないと
  // 「解除されないケース」が残っている。
  expect(scrollLockCount()).toBe(0);
  document.body.style.overflow = '';
});

// ═══════════════════════════════════════════════════════════════
// 参照カウント単体
// ═══════════════════════════════════════════════════════════════

describe('scroll lock refcount', () => {
  it('元の値を保存して復元する', () => {
    document.body.style.overflow = 'scroll';

    acquireScrollLock();
    expect(overflow()).toBe('hidden');

    releaseScrollLock();
    expect(overflow()).toBe('scroll');
  });

  it('入れ子の acquire は最後の release までロックを保つ', () => {
    acquireScrollLock();
    acquireScrollLock();
    expect(scrollLockCount()).toBe(2);

    releaseScrollLock();
    expect(overflow()).toBe('hidden');

    releaseScrollLock();
    expect(overflow()).toBe('');
  });

  it('2人目は1人目のロック値を「元の値」として保存しない', () => {
    acquireScrollLock(); // 元の値 '' を保存
    acquireScrollLock(); // 'hidden' を掴んではいけない
    releaseScrollLock();
    releaseScrollLock();

    expect(overflow()).toBe('');
  });

  it('acquire していない release はカウントを負に沈めない', () => {
    releaseScrollLock();
    releaseScrollLock();
    expect(scrollLockCount()).toBe(0);

    acquireScrollLock();
    expect(overflow()).toBe('hidden');
    releaseScrollLock();
    expect(overflow()).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════
// 複数の <overlay-dialog> が同居するケース
//
// body.style.overflow はグローバルな資源なので、要素が2つ以上あると
// 「解除されない」「開いているのに解除される」の両方が起きうる。
// ═══════════════════════════════════════════════════════════════

describe('複数インスタンスでのスクロールロック', () => {
  it('同じコントローラーに2つの要素がぶら下がっても閉じれば復元される', async () => {
    const dialog = new DialogController();
    const a = await mountDialog(dialog);
    const b = await mountDialog(dialog);

    dialog.alert('hi');
    expect(overflow()).toBe('hidden');

    dialog.hide();
    expect(overflow()).toBe('');

    a.cleanup();
    b.cleanup();
  });

  it('表示中に後から生えた要素があっても閉じれば復元される', async () => {
    const dialog = new DialogController();
    const a = await mountDialog(dialog);

    dialog.alert('hi');
    // 開いている最中にもう1つマウントする (遅延マウント / 再描画)
    const b = await mountDialog(dialog);
    dialog.setLabel('進行中');
    expect(overflow()).toBe('hidden');

    dialog.hide();
    expect(overflow()).toBe('');

    a.cleanup();
    b.cleanup();
  });

  it('独立した2インスタンスが重なっても、手前が閉じるまで解除しない', async () => {
    const first = new DialogController();
    const second = new DialogController();
    const a = await mountDialog(first);
    const b = await mountDialog(second);

    first.alert('1枚目');
    second.alert('2枚目');
    expect(overflow()).toBe('hidden');

    // 1枚目だけ閉じる — 2枚目はまだ出ているのでロックは続くこと
    first.hide();
    expect(overflow()).toBe('hidden');

    second.hide();
    expect(overflow()).toBe('');

    a.cleanup();
    b.cleanup();
  });

  it('残留した hidden を「元の値」として抱え込まない (自己増殖しない)', async () => {
    const dialog = new DialogController();
    const a = await mountDialog(dialog);

    for (let i = 0; i < 3; i++) {
      dialog.alert(`${i}回目`);
      expect(overflow()).toBe('hidden');
      dialog.hide();
      expect(overflow()).toBe('');
    }

    a.cleanup();
  });
});

// ═══════════════════════════════════════════════════════════════
// 接続 / 切断 / 再入
// ═══════════════════════════════════════════════════════════════

describe('接続と切断', () => {
  it('表示中に DOM を移動しても (再接続) ロックが外れない', async () => {
    const dialog = new DialogController();
    const a = await mountDialog(dialog);

    dialog.alert('hi');
    expect(overflow()).toBe('hidden');

    const holder = document.createElement('div');
    document.body.appendChild(holder);
    holder.appendChild(a.el); // disconnect + reconnect
    await a.el.updateComplete;

    expect(overflow()).toBe('hidden');

    dialog.hide();
    expect(overflow()).toBe('');

    holder.remove();
  });

  it('表示中に取り外した要素は自分のぶんだけ返す', async () => {
    const dialog = new DialogController();
    const a = await mountDialog(dialog);
    const b = await mountDialog(dialog);

    dialog.alert('hi');
    expect(scrollLockCount()).toBe(2);

    a.cleanup();
    // まだ b が表示しているのでロックは続く
    expect(overflow()).toBe('hidden');

    b.cleanup();
    expect(overflow()).toBe('');
  });

  it('最後の要素を表示中に取り外したらロックを返す', async () => {
    const dialog = new DialogController();
    const a = await mountDialog(dialog);

    dialog.alert('hi');
    expect(overflow()).toBe('hidden');

    a.cleanup();
    expect(overflow()).toBe('');
  });

  it('既に開いているコントローラーに繋いだ要素もロックを取る', async () => {
    const dialog = new DialogController();
    dialog.alert('先に開く'); // 要素はまだない
    expect(overflow()).toBe('');

    const a = await mountDialog(dialog);
    expect(overflow()).toBe('hidden');

    dialog.hide();
    expect(overflow()).toBe('');

    a.cleanup();
  });

  it('閉じる通知の最中に開き直してもロックが外れない', async () => {
    const dialog = new DialogController();
    // 要素より先に購読する = 要素より先にこのリスナーが走る
    let armed = false;
    dialog.subscribe((s) => {
      if (armed && !s.open) {
        armed = false;
        dialog.alert('次のダイアログ');
      }
    });
    const a = await mountDialog(dialog);

    dialog.alert('最初');
    expect(overflow()).toBe('hidden');

    armed = true;
    dialog.hide(); // 通知の途中で再オープンされる

    expect(dialog.state.open).toBe(true);
    expect(overflow()).toBe('hidden');

    dialog.hide();
    expect(overflow()).toBe('');

    a.cleanup();
  });
});
