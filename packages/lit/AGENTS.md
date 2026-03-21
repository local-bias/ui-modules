# @konomi-app/ui

Lit ベースの Web Component。フレームワーク非依存。

## デザインコンセプト

- シンプルでミニマルなUI
- アニメーションを用いた高いUX
- 柔軟なAPIで多様なユースケースに対応

## インストール

```bash
pnpm add @konomi-app/ui
```

## アーキテクチャ

```
dialog (Public API singleton)  ← ユーザーが触る
  └─ DialogController (状態管理)  ← ロジック層
       └─ <overlay-dialog> (Lit Web Component)  ← 描画層
```

## API

```typescript
import { dialog } from '@konomi-app/ui';
```

### Loading

```ts
dialog.showLoading('読み込み中...');
dialog.setProgress(50);
dialog.setLabel('半分完了');
dialog.hide();

// 外側クリックで閉じる場合は明示的に指定
dialog.show({ type: 'loading', label: '...', allowOutsideClick: true });
```

### Alert

```ts
// シンプル
await dialog.alert('保存が完了しました');

// 詳細
const result = await dialog.alert({
  type: 'success', // 'success' | 'error' | 'warning' | 'info'
  label: '完了',
  description: '処理が正常に完了しました',
  html: '<b>太字テキスト</b>や<a href="#">リンク</a>も使えます', // HTMLを直接指定
  showCancelButton: true,
  confirmButtonText: '続行',
  cancelButtonText: 'キャンセル',
  timer: 3000, // 自動で閉じる (ms)
});
// result: { isConfirmed, isCanceled, isDismissed }
```

### Confirm

```ts
if (await dialog.confirm('本当に削除しますか？')) {
  // 削除処理
}
```

### Queue (タスクキュー)

```ts
// 文字列のみ指定 — key と label が同じ値になる
dialog.showQueue(['前処理', '検証', 'アップロード']);
dialog.activateQueue('前処理');
dialog.completeQueue('前処理');
dialog.skipQueue('検証');
dialog.activateQueue('アップロード');
dialog.completeQueue('アップロード');
dialog.hide();
dialog.clearQueue();

// key と label を個別に指定
dialog.showQueue([
  { key: 'preprocess', label: '前処理' },
  { key: 'validate', label: '検証' },
  { key: 'upload', label: 'アップロード' },
]);
dialog.activateQueue('preprocess');
dialog.completeQueue('preprocess');
dialog.skipQueue('validate');
dialog.activateQueue('upload');
dialog.completeQueue('upload');
dialog.hide();
dialog.clearQueue();
```

### Steps (ステップ制御)

```ts
// 文字列のみ指定 — key と label が同じ値になる
dialog.showSteps(['ステップ1', 'ステップ2', 'ステップ3']);
dialog.activateStep('ステップ1');
dialog.completeStep('ステップ1');
dialog.activateStep('ステップ2');
dialog.completeStep('ステップ2');
dialog.hide();
dialog.clearSteps();

// key と label を個別に指定
dialog.showSteps([
  { key: 'step1', label: 'ステップ1' },
  { key: 'step2', label: 'ステップ2' },
  { key: 'step3', label: 'ステップ3' },
]);
dialog.activateStep('step1');
dialog.completeStep('step1');
```

## CSS カスタマイズ

`<overlay-dialog>` は CSS 変数でカスタマイズ可能:

```css
overlay-dialog {
  --dialog-primary: #3b82f6;
  --dialog-card-bg: #fff;
  --dialog-backdrop-color: rgb(255 255 255 / 0.73);
  --dialog-backdrop-blur: 4px;
  --dialog-card-width: 400px;
  --dialog-card-radius: 4px;
  --dialog-z-index: 1000;
  --dialog-spinner-size: 60px;
  /* 他多数 — src/styles.ts 参照 */
}
```

## 高度な使用法

```ts
import { DialogController, OverlayDialog } from '@konomi-app/ui';

// 独自インスタンス
const ctrl = new DialogController();
const el = document.createElement('overlay-dialog') as OverlayDialog;
el.controller = ctrl;
document.body.appendChild(el);

ctrl.alert({ label: 'カスタムインスタンス' });
```
