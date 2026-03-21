import { getBodyStyle, getRootStyle } from './style';

export const ATTRIBUTE_KEY = 'data-konomi-ui-overlay';
export const ATTRIBUTE_SHOWN = 'data-shown';

export class Overlay {
  /**
   * オーバーレイをレンダリングするルート要素。
   */
  readonly #root: HTMLDivElement;
  /**
   * オーバーレイをレンダリングするルート要素の`dataset`。
   */
  protected readonly _rootDataset: DOMStringMap;
  /**
   * オーバーレイが表示されているかどうか。
   */
  protected _shown: boolean;
  /**
   * オーバーレイを表示中にページを離れようとした場合にアラートを表示するかどうかを設定します。
   */
  protected _disableBeforeUnload: boolean;

  public constructor() {
    this._shown = false;
    this._disableBeforeUnload = false;
    this._rootDataset = {};

    const root = document.createElement('div');
    this.#root = root;
    this.#root.classList.add(getRootStyle());
    document.body.classList.add(getBodyStyle());
    this.#root.setAttribute(ATTRIBUTE_KEY, '');
    document.body.append(root);
  }

  public show(): void {
    this._shown = true;
    this.#root.setAttribute(ATTRIBUTE_SHOWN, '');
    document.body.setAttribute(ATTRIBUTE_KEY, '');
    window.addEventListener('beforeunload', this.beforeunload);
    this.render();
  }

  public hide(): void {
    this._shown = false;
    this.#root.removeAttribute(ATTRIBUTE_SHOWN);
    document.body.removeAttribute(ATTRIBUTE_KEY);
    window.removeEventListener('beforeunload', this.beforeunload);
    this.render();
  }

  protected render(): void {}

  /** JavaScript中にページを離れようとした場合にアラートを表示します */
  private beforeunload(event: BeforeUnloadEvent): void {
    event.preventDefault();
  }

  protected get root(): HTMLDivElement {
    return this.#root;
  }

  /** @deprecated このメソッドは非推奨です。代わりに`show`メソッドを使用してください。 */
  public start(): void {
    this.show();
  }
  /** @deprecated このメソッドは非推奨です。代わりに`hide`メソッドを使用してください。 */
  public stop(): void {
    this.hide();
  }
}
