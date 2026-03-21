import { Overlay } from '../overlay';
import { containerStyle, getLoaderStyle, progressStyle } from './style';

type Label = string | string[];
type ConstructorProps = Readonly<Partial<{ label: Label; progress: number }>>;

export const ATTRIBUTE_ANIMATION = 'data-animation';

export class LoadingOverlay extends Overlay {
  #label: Label;
  #html: string;
  #progress: number | null;

  protected readonly _loaderElement: HTMLDivElement;
  protected readonly _progressElement: HTMLDivElement;
  protected readonly _contentElement: HTMLDivElement;

  public constructor(props: ConstructorProps = {}) {
    super();

    this.#label = props.label ?? '';
    this.#html = '';
    this.#progress = props.progress ?? null;

    const container = document.createElement('div');
    container.classList.add(containerStyle);
    this.root.append(container);

    const loaderElement = document.createElement('div');
    loaderElement.innerHTML = '<div><div></div></div>';
    loaderElement.classList.add(getLoaderStyle());
    this._loaderElement = loaderElement;
    container.append(loaderElement);

    const progressElement = document.createElement('div');
    progressElement.classList.add(progressStyle);
    this._progressElement = progressElement;
    container.append(progressElement);

    const contentElement = document.createElement('div');
    this._contentElement = contentElement;
    container.append(contentElement);

    this.render();
  }

  override show(): void {
    super.show();
    this._loaderElement.setAttribute(ATTRIBUTE_ANIMATION, '');
  }

  override hide(): void {
    super.hide();
    this._loaderElement.removeAttribute(ATTRIBUTE_ANIMATION);
    this.#progress = 0;
    this.#html = '';
    this.#label = '';
  }

  public set label(label: Label) {
    this.#label = label;
    this.render();
  }

  public set html(html: string) {
    this.#html = html;
    this.render();
  }

  /**
   * 進捗状況を設定します。
   * @param percent 進捗のパーセンテージ(0-100)
   */
  public set progress(percent: number) {
    this.#progress = percent;
    this.render();
  }

  override render(): void {
    super.render();

    this._progressElement.style.width = `${this.#progress}%`;

    if (this.#html) {
      this._contentElement.innerHTML = this.#html;
    } else {
      if (this.#label instanceof Array) {
        this._contentElement.innerHTML = `<div>${this.#label.join('</div><div>')}</div>`;
      } else {
        this._contentElement.innerText = this.#label;
      }
    }
  }
}
