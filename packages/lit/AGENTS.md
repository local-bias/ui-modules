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

ダイアログの中身は 2 層に分かれている。

| 層 | 実体 | 寿命 |
| --- | --- | --- |
| **クローム** (上部常駐) | ステップインジケータ (`state.steps`) | `clearSteps()` / `hide()` まで |
| **本文** | `state.dialogType` が選ぶ 1 つ — `loading` / `alert` / `confirm` / `queue` / `form` / `step-form` | 次の本文に差し替わるまで |

本文は排他だが、クロームは本文の差し替えをまたいで残る。

### 破壊的変更 (v6)

- `DialogType` から `'steps'` を削除。Steps は本文ではなくクロームになった
- `showSteps()` の本文は既定でローディング。ステップ名の**縦**リスト表示は廃止され、
  上部クロームの横並びインジケータ (ドット + ラベル) になった。
  縦のラベル付きタスクリストが必要なら `showQueue()` を使う
- `state.stepFormSteps` / `state.stepFormCurrentIndex` を削除。
  ウィザードは `state.steps` + `state.stepIndex` を Steps と共有する
- `StepFormItem` 型を削除
- `updateStepFormField()` / `touchStepFormField()` を削除。
  `updateFormField()` / `touchFormField()` に統合 (ウィザードでも同じものを使う)

## テスト

Vitest + happy-dom。テストは実装と同じ場所に `*.test.ts` として置く。

```bash
pnpm test            # 1回実行
pnpm test:watch      # ウォッチ
pnpm test:coverage   # カバレッジ (閾値 80% — 下回ると失敗する)
pnpm typecheck       # tsc --noEmit (テストも型チェック対象)
```

| ファイル | 対象 |
| --- | --- |
| `controller.test.ts` | 状態遷移 — クロームの寿命、ウィザード、フォーム検証、タイマー |
| `overlay-dialog.test.ts` | 描画 — クロームの配置とノード維持、各本文、a11y、フォーカス |
| `dialog.test.ts` | シングルトンの委譲と要素の遅延生成 |
| `step-utils.test.ts` / `form-date-utils.test.ts` / `focus-trap.test.ts` / `width-utils.test.ts` | 純粋関数 |
| `scroll-lock.test.ts` | body スクロールロックの参照カウントと、要素が複数同居する場合の解除 |
| `zod-utils.test.ts` | Zod スキーマからのフィールド抽出 |
| `toast/*.test.ts` | Toast のコントローラーと描画 |

`npx tsc` はスタブパッケージに解決されてしまうので、型チェックは `pnpm typecheck`
(= ローカルの `node_modules/.bin/tsc`) を使うこと。

## API

```typescript
import { dialog } from '@konomi-app/ui';
```

### Loading

```ts
dialog.showLoading('読み込み中...');
dialog.setProgress(50);
dialog.setLabel('半分完了');
dialog.setHtml('<b>処理中</b>: <span style="color:blue">ステップ1</span>');
dialog.hide();

// 外側クリックで閉じる場合は明示的に指定
dialog.show({ type: 'loading', label: '...', allowOutsideClick: true });

// HTML コンテンツを表示 (label の位置に描画)
dialog.show({ type: 'loading', html: '<b>処理中</b>: <em>ファイルをアップロード中</em>' });
```

### Alert

```ts
// シンプル
await dialog.alert('保存が完了しました');

// 詳細
const result = await dialog.alert({
  type: 'success', // 'success' | 'error' | 'warning' | 'info'
  title: '完了',
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

**key は一意にすること**。key はステータス更新の宛先で、重複すると更新が常に先頭の項目に
当たり、2件目以降は `pending` のまま取り残される (進捗カウンタも埋まらない)。文字列指定は
key と label が同じ値になるので、同じラベルを並べると踏む。重複を検出すると警告を出す。

```ts
dialog.showQueue(['アップロード', 'アップロード']); // NG — key が重複する
dialog.showQueue([
  { key: 'upload-1', label: 'アップロード' },
  { key: 'upload-2', label: 'アップロード' },
]); // OK — label は重なってよい
```

キューは**並列実行を想定**しており、`activateQueue()` は active を1つに絞らない。複数の項目を
同時に実行中にでき、それぞれ個別に `completeQueue()` / `failQueue()` で決着させられる
(現在位置を1つに保つ `activateStep()` とは対照的)。

進行の読み取りやすさは**表示順**が担保する。描画側は **完了 → 実行中 → 待機** の順に並べ替えて
表示するので、active が複数残っていても上から順に片付いていくのが分かる。決着済み
(`done` / `skipped` / `error`) は同じ段に置き、同じ段の中では宣言順を保つ (安定ソート)。
逐次実行なら active より前は必ず決着済みなので、この並べ替えは恒等になる。

並べ替えは表示だけの話で、**`state.queues` は宣言順のまま**変わらない。

存在しない key を渡した呼び出しは無視されるが、黙って捨てずに警告を出す。

### Steps (常駐ステップインジケータ)

Steps は**本文の一種ではなく、ダイアログ上部に常駐するクローム**。一度表示したら
`clearSteps()` / `hide()` が呼ばれるまで、本文が loading / queue / alert / confirm / form の
どれに差し替わっても表示され続ける。

各ステップはドットとラベルを持つ横並びのインジケータとして描画され、現在ステップが
強調される。ラベルは `items` に渡した文字列 (または `label`) がそのまま使われる。

```text
   ●━━━━━━●━━━━━━○━━━━━━○
  取得    処理    通知    完了
            2 / 4
```

ラベルは等幅カラムに折り返して表示されるため、**ステップ数が多い / ラベルが長いほど窮屈になる**。
既定のカード幅 (400px) なら 3〜5 ステップ、各 4〜6 文字程度が目安。長い説明は
ラベルではなく本文側 (`showSteps()` の `label` / `description`) に置く。

| API | 役割 |
| --- | --- |
| `showSteps(items, options?)` | クロームを表示してダイアログを開く (本文は既定でローディング) |
| `setStepItems(items)` | ステップを差し替える (開閉には影響しない) |
| `activateStep(key)` | **現在位置を移す唯一の API**。他の `active` は `pending` に戻る |
| `completeStep(key)` / `skipStep(key)` / `failStep(key)` | 状態だけを変える。現在位置は動かさない |
| `clearSteps()` | クロームを破棄する (ダイアログは閉じない) |

```ts
// 文字列のみ指定 — key と label が同じ値になる
dialog.showSteps(['ステップ1', 'ステップ2', 'ステップ3'], { title: '同期処理' });
dialog.activateStep('ステップ1');
dialog.completeStep('ステップ1');
dialog.activateStep('ステップ2');
dialog.completeStep('ステップ2');
dialog.clearSteps();
dialog.hide();

// key と label を個別に指定
dialog.showSteps([
  { key: 'step1', label: 'ステップ1' },
  { key: 'step2', label: 'ステップ2' },
  { key: 'step3', label: 'ステップ3' },
]);
```

**本文と組み合わせる** — クロームが出ている間、本文は自由に差し替えられる。
ステップ2の最中だけダイアログ上に Queue を出す、といった構成がそのまま書ける。

```ts
dialog.showSteps(['データ取得', 'ファイル処理', '完了通知']);

dialog.activateStep('データ取得');
await fetchData();
dialog.completeStep('データ取得');

// ステップ2 — 本文だけ Queue に差し替える。上部のステップ表示は残ったまま
dialog.activateStep('ファイル処理');
dialog.showQueue(files.map((f) => f.name));
for (const f of files) {
  dialog.activateQueue(f.name);
  await process(f);
  dialog.completeQueue(f.name);
}
dialog.completeStep('ファイル処理');

// ステップ3 — 本文だけ confirm に差し替える
dialog.activateStep('完了通知');
if (await dialog.confirm('通知を送信しますか？')) {
  await notify();
  dialog.completeStep('完了通知');
} else {
  dialog.skipStep('完了通知');
}

dialog.clearSteps();
dialog.hide();
```

**注意点:**

- クロームが有効な間、`alert` / `confirm` / `form` が決着してもダイアログは閉じず、
  中立のローディング本文に戻る。終了させるのは `hide()`。
- `title` は本文ごとの値。本文を差し替えると消えるので、必要なら `setTitle()` で指定し直す。
- Queue との使い分け — 縦に並ぶラベル付きタスクリストが欲しいなら Queue (本文)、
  工程全体の進捗インジケータが欲しいなら Steps (クローム)。

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
- `戻る` — 前のステップへ戻る (バリデーションなし。入力値は保持される)
- `送信` (最終ステップ) — バリデーション成功後、全ステップの入力データを返す
- `キャンセル` — `null` を返す

スキーマなしのステップは、説明や確認用の静的コンテンツステップとして使用可能。

**Steps クロームとの関係:**

Step Form は独自のステップ状態を持たず、上記 Steps のクロームをそのまま使う
(`showStepForm()` は内部で `state.steps` を組み立て、`activateStep()` で現在位置を動かす)。
そのため `skipStep()` / `failStep()` がウィザードの実行中にもそのまま効く。

```ts
const result = dialog.showStepForm([...]);

// 条件によってステップを飛ばす — `次へ` / `戻る` がこのステップを飛び越えるようになり、
// 戻り値にもこのステップのデータは含まれない
if (!needsSettings) dialog.skipStep('settings');

// サーバー側の失敗をステップに反映する。現在位置は動かないので、
// そのステップに留まったままインジケータだけが赤くなる
try {
  await submit();
} catch {
  dialog.failStep('confirm');
}
```

`failStep()` を付けたステップも、入力を直して `次へ` を押せばバリデーション成功時に
`done` へ復帰する。

ウィザードは自分が出したクロームの持ち主なので、送信・キャンセル・他ダイアログによる
割り込みのいずれでも、終了時にクロームごと片付けられる。

## 幅 (width)

すべてのダイアログは `width` オプションで幅を指定できる。未指定なら `dialogType`
ごとの既定幅 (loading/queue 400px, alert/confirm 480px, form/step-form 500px)。

```ts
dialog.alert({ title: '確認', width: 'lg' }); // トークン
dialog.form(schema, { width: 720 });          // 数値 = px
dialog.show({ type: 'queue', width: 'clamp(320px, 60vw, 720px)' }); // CSS 文字列

// 開いたまま変える (幅は 360ms でアニメーションする)
dialog.showLoading('集計中');
dialog.setWidth('xl');
```

| 指定 | 意味 |
| --- | --- |
| `'sm'` / `'md'` / `'lg'` / `'xl'` / `'full'` | トークン。実寸は `--dialog-width-*` で再調整できる |
| `number` | px として解釈 (正の数のみ) |
| `string` | CSS 長さ (`400px` `80%` `50vw` …) または `clamp()` / `min()` / `max()` / `calc()` / `var()` |

不正な値 (単位なしの数値、`;` を含む値、`url()` など) は `console.warn` を出して
既定幅にフォールバックする — 値をそのまま CSS に流し込むことはない。

### 幅の寿命

幅は「今表示している本文」のものであって、セッションをまたいで残らない。

- 本文を出す API (`show()` / `alert()` / `confirm()` / `form()` / `showSteps()` /
  `showStepForm()`) は毎回幅を決め直す。`width` を省略すればその type の既定幅に戻る
- `setWidth()` は今の本文にだけ効き、次に本文を出す API が呼ばれると上書きされる
- `hide()`、および steps クロームへ本文が畳まれるときも既定に戻る

ステップフォームはステップ単位でも指定でき、そちらが `showStepForm()` の `width`
より優先される (ステップ移動のたびに再適用されるので、ウィザード中の `setWidth()` は残らない)。

```ts
dialog.showStepForm(
  [
    { key: 'basic', label: '基本', schema: basicSchema },
    { key: 'detail', label: '詳細', schema: detailSchema, width: 'xl' }, // このステップだけ広く
  ],
  { width: 'lg' } // 他のステップの既定
);
```

### モバイル

640px 未満ではカードは全幅のボトムシートになるため、`width` の指定は効かない。
幅が効くのは 640px 以上のみ。

## 高さ (ビューポート収容)

**中身がどれだけ長くてもカードはビューポートからはみ出さない。** 高さの制御は
呼び出し側ではなくライブラリ側の責務なので、`html` / `description` / Queue の項目数 /
フォームの項目数がいくら増えても、上下が画面外に切れてボタンが押せなくなることはない。

カードの構造は 3 段。

| 領域 | 中身 | 挙動 |
| --- | --- | --- |
| ヘッダー | `title` / Steps クローム | 上部に固定 |
| 本文 (`.card-body`) | 本文コンテンツ | 収まらない分はここが縦スクロールする |
| フッター (`.card-footer`) | 確定 / キャンセル / 次へ・戻る | 下部に固定。常に見えて押せる |

- カードの上限高さは `--dialog-card-max-height` (既定 `100%` = ビューポート -
  `--dialog-viewport-gutter` × 2)。`80dvh` などに絞ることもできる
- 640px 以上ではカードと画面端の間に `--dialog-viewport-gutter` (既定 16px) の余白が入る
- 背景は `100dvh` 基準。モバイルのアドレスバーに隠れて下端のボタンが押せなくなることはない
- 画面が低いときは `--dialog-card-min-height` (既定 200px) より収まりが優先される
- フォームはこれに加えて `--dialog-form-max-height` (既定 60vh) で入力欄側だけを
  独立にスクロールさせる

```css
overlay-dialog {
  --dialog-card-max-height: 80dvh; /* もっと余白が欲しい場合 */
  --dialog-viewport-gutter: 24px;
}
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
  /* 高さ (ビューポート収容) */
  --dialog-card-max-height: 100%;
  --dialog-viewport-gutter: 16px;
  /* width トークンの実寸 */
  --dialog-width-sm: 320px;
  --dialog-width-md: 400px;
  --dialog-width-lg: 500px;
  --dialog-width-xl: 720px;
  --dialog-width-full: 100%;
  /* 全 type 共通の幅上書き (呼び出し側の width 指定があればそちらが勝つ) */
  /* --dialog-width: 600px; */
  --dialog-z-index: 1000;
  --dialog-spinner-size: 60px;
  /* Steps */
  --dialog-step-label-size: 12px;
  --dialog-step-label-color: #6b7280; /* 未到達ステップのラベル色 */
  /* Form */
  --dialog-form-width: 500px;
  --dialog-form-columns: 1;
  --dialog-form-gap: 16px;
  --dialog-form-input-radius: 6px;
  /* 他多数 — src/styles.ts 参照 */
}
```

## 設定 (i18n / HTML サニタイズ)

```ts
dialog.configure({
  // 既定のボタン文言・select プレースホルダーを上書き (i18n)
  texts: {
    confirmButtonText: 'OK',
    cancelButtonText: 'Cancel',
    stepFormNextText: 'Next',
    stepFormPrevText: 'Back',
    stepFormSubmitText: 'Submit',
    selectPlaceholder: 'Select…',
    dialogAriaLabel: 'Dialog', // title/label が無い場合のフォールバック aria-label
  },
  // html / setHtml() で渡した文字列は unsafeHTML でそのまま描画される。
  // ユーザー入力を渡す可能性がある場合は、信頼できるサニタイザを指定すること。
  sanitizeHtml: (html) => DOMPurify.sanitize(html),
});
```

**注意**: `html` オプションおよび `dialog.setHtml()` は既定でサニタイズされない。ユーザー入力に由来する可能性のある文字列を渡す場合は、必ず `sanitizeHtml` を設定するか、呼び出し側で事前にサニタイズすること。

`toast.configure({ texts: { closeLabel, regionLabel } })` で Toast 側の aria-label も同様に上書き可能。

## 高度な使用法

```ts
import { DialogController, OverlayDialog } from '@konomi-app/ui';

// 独自インスタンス
const ctrl = new DialogController();
const el = document.createElement('overlay-dialog') as OverlayDialog;
el.controller = ctrl;
document.body.appendChild(el);

ctrl.alert({ title: 'カスタムインスタンス' });
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
