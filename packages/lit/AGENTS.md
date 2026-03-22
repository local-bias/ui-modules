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

### Form (Zod スキーマ連動フォーム)

Zod スキーマからフォームを自動生成。バリデーション・エラー表示・レイアウトカスタマイズに対応。

```ts
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1).describe('名前'),
  email: z.string().email().describe('メールアドレス'),
  age: z.number().min(0).max(150).optional().describe('年齢'),
  role: z.enum(['admin', 'editor', 'viewer']).describe('権限'),
  active: z.boolean().default(true).describe('有効'),
});

// 基本
const result = await dialog.form(schema, {
  title: 'ユーザー作成',
});
// result: { name, email, age?, role, active } | null (キャンセル時)

// レイアウト指定
const result = await dialog.form(schema, {
  title: '登録',
  description: '以下の情報を入力してください',
  layout: {
    columns: 2,
    groups: [
      { label: '基本情報', fields: ['name', 'email'] },
      { label: '設定', fields: ['role', 'active'] },
    ],
  },
  defaultValues: { role: 'viewer' },
  confirmButtonText: '作成',
  cancelButtonText: 'やめる',
});
```

**サポートするフィールドタイプ:**

| Zod type      | Input type                                |
| ------------- | ----------------------------------------- |
| `z.string()`  | text (`.email()` → email, `.url()` → url) |
| `z.number()`  | number                                    |
| `z.boolean()` | checkbox                                  |
| `z.enum()`    | select                                    |
| `z.date()`    | date                                      |

`.optional()`, `.default()`, `.describe()`, `.refine()` をサポート。

### Step Form (ステップフォーム)

各ステップに異なる Zod スキーマを持たせる、ウィザード形式のフォームダイアログ。

```ts
import { z } from 'zod';

const result = await dialog.showStepForm(
  [
    {
      key: 'personal',
      label: '個人情報',
      schema: z.object({
        name: z.string().min(1).describe('名前'),
        email: z.string().email().describe('メールアドレス'),
      }),
      layout: { columns: 2 },
    },
    {
      key: 'settings',
      label: '設定',
      description: '権限と通知設定を選択してください',
      schema: z.object({
        role: z.enum(['admin', 'editor', 'viewer']).describe('権限'),
        notifications: z.boolean().default(true).describe('通知を受け取る'),
      }),
    },
    {
      key: 'confirm',
      label: '確認',
      description: '入力内容を確認して送信してください。',
      // schema 省略 → フォームなしの説明ステップ
    },
  ],
  {
    title: 'ユーザー登録',
    nextButtonText: '次へ',
    prevButtonText: '戻る',
    submitButtonText: '登録',
    cancelButtonText: 'キャンセル',
  }
);
// result: { personal: { name, email }, settings: { role, notifications } } | null (キャンセル時)
```

**ナビゲーション:**

- `次へ` — 現在ステップのバリデーションを実行。成功したら次のステップへ進む
- `戻る` — 前のステップへ戻る (バリデーションなし)
- `送信` (最終ステップ) — バリデーション成功後、全ステップの入力データを返す
- `キャンセル` — `null` を返す

スキーマなしのステップは、説明や確認用の静的コンテンツステップとして使用可能。

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
  /* Form */
  --dialog-form-width: 500px;
  --dialog-form-columns: 1;
  --dialog-form-gap: 16px;
  --dialog-form-input-radius: 6px;
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

## Toast API

```typescript
import { toast } from '@konomi-app/ui';
```

### 基本

```ts
toast.success('保存しました');
toast.error('エラーが発生しました');
toast.warning('注意が必要です');
toast.info('お知らせ');
```

### 詳細オプション

```ts
toast.success('保存しました', {
  description: '変更がデータベースに反映されました',
  duration: 5000, // 表示時間 (ms)。デフォルト: 4000。0 = 永続表示
});

// アクションボタン付き
toast.info('ファイルを削除しました', {
  action: {
    label: '元に戻す',
    onClick: () => undoDelete(),
  },
});
```

### 汎用

```ts
const id = toast.show({
  type: 'info',
  message: '処理中...',
  description: 'しばらくお待ちください',
  duration: 0, // 自動で消えない
});
```

### ローディング

```ts
const id = toast.loading('アップロード中...');

// 処理完了後に同じトーストを結果表示に更新
// → loading から成功/失敗に遷移すると自動で defaultDuration のタイマーが起動
toast.update(id, { type: 'success', message: 'アップロード完了' });
toast.update(id, { type: 'error', message: '失敗しました', description: 'ネットワークエラー' });

// タイマーを明示的に指定して遷移
toast.update(id, { type: 'success', message: '完了', duration: 2000 });

// 永続表示のまま遷移 (duration: 0)
toast.update(id, { type: 'error', message: 'エラー', duration: 0 });
```

### プログラマティック操作

```ts
// 特定のトーストを閉じる
toast.dismiss(id);

// 全トーストを閉じる
toast.dismissAll();

// 既存トーストの内容を更新
toast.update(id, {
  message: '完了しました',
  type: 'success',
});
```

### 設定

```ts
toast.configure({
  position: 'top-right', // 'bottom-right'(default) | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center'
  maxVisible: 5, // 最大同時表示数 (default: 3)
  defaultDuration: 3000, // デフォルト表示時間 (default: 4000)
});
```

### 機能一覧

- **自動非表示**: 設定した時間後に自動で消える (プログレスバーで残り時間を表示)
- **キュー管理**: 最大表示数を超えると古いトーストから自動で消える
- **ホバー一時停止**: ホバー中はタイマーとプログレスバーが一時停止
- **スムーズアニメーション**: スライドイン/アウト + 高さの自動調整
- **レスポンシブ**: モバイルでは全幅表示

## Toast CSS カスタマイズ

`<toast-container>` は CSS 変数でカスタマイズ可能:

```css
toast-container {
  --toast-z-index: 1100;
  --toast-max-width: 420px;
  --toast-card-bg: #fff;
  --toast-card-radius: 8px;
  --toast-card-shadow: 0 4px 12px rgb(0 0 0 / 0.08);
  --toast-success: #22c55e;
  --toast-error: #ef4444;
  --toast-warning: #f59e0b;
  --toast-info: #3b82f6;
  --toast-progress-height: 3px;
  /* 他多数 — src/toast/styles.ts 参照 */
}
```

## 高度な使用法 (Toast)

```ts
import { ToastController, ToastContainer } from '@konomi-app/ui';

// 独自インスタンス
const ctrl = new ToastController();
const el = document.createElement('toast-container') as ToastContainer;
el.controller = ctrl;
document.body.appendChild(el);

ctrl.success('カスタムインスタンス');
```
