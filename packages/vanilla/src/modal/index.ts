import { Overlay } from '../overlay';
import {
  actionsStyle,
  containerStyle,
  iconStyle,
  loaderStyle,
  progressStyle,
  titleStyle,
} from './style';

type Label = string | string[];
type ConstructorProps = Readonly<Partial<{ label: Label; progress: number }>>;

export class Modal extends Overlay {
  #title: string;
  #html: string;
  #label: Label;
  #progress: number | null;
  #state: 'loading' | 'alert' | 'hidden';

  protected readonly _containerElement: HTMLDivElement;
  protected readonly _iconElement: HTMLDivElement;
  protected readonly _titleElement: HTMLDivElement;
  protected readonly _loaderElement: HTMLDivElement;
  protected readonly _progressElement: HTMLDivElement;
  protected readonly _contentElement: HTMLDivElement;
  protected readonly _actionsElement: HTMLDivElement;
  protected readonly _okButtonElement: HTMLButtonElement;
  protected readonly _cancelButtonElement: HTMLButtonElement;

  public constructor(props: ConstructorProps = {}) {
    super();

    this.#title = '';
    this.#html = '';
    this.#label = props.label ?? '';
    this.#progress = props.progress ?? null;
    this.#state = 'hidden';

    const container = document.createElement('div');
    container.classList.add(containerStyle);
    this._containerElement = container;
    this.root.append(container);

    const iconElement = document.createElement('div');
    iconElement.classList.add(iconStyle);
    this._iconElement = iconElement;
    container.append(iconElement);

    const titleElement = document.createElement('div');
    titleElement.classList.add(titleStyle);
    this._titleElement = titleElement;
    container.append(titleElement);

    const loaderElement = document.createElement('div');
    loaderElement.innerHTML = '<div><div></div></div>';
    loaderElement.classList.add(loaderStyle);
    this._loaderElement = loaderElement;

    const progressElement = document.createElement('div');
    progressElement.classList.add(progressStyle);
    this._progressElement = progressElement;
    container.append(progressElement);

    const contentElement = document.createElement('div');
    this._contentElement = contentElement;
    container.append(contentElement);

    const actionsElement = document.createElement('div');
    actionsElement.classList.add(actionsStyle);
    this._actionsElement = actionsElement;
    container.append(actionsElement);

    const okButtonElement = document.createElement('button');
    okButtonElement.type = 'button';
    okButtonElement.textContent = 'OK';
    this._okButtonElement = okButtonElement;
    actionsElement.append(okButtonElement);

    const cancelButtonElement = document.createElement('button');
    cancelButtonElement.type = 'button';
    cancelButtonElement.textContent = 'キャンセル';
    this._cancelButtonElement = cancelButtonElement;
    actionsElement.append(cancelButtonElement);

    this.render();
  }

  public alert(params: {
    title?: string;
    text?: string;
    icon?: string;
    disableClose?: boolean;
    disableEscape?: boolean;
  }): Promise<any> {
    const {
      title = '',
      text = '',
      icon = '',
      disableClose = false,
      disableEscape = false,
    } = params;
    this.#title = title;
    this.#label = text;

    this.changeState('alert');
    this.show();

    return new Promise((resolve) => {
      this._okButtonElement.addEventListener('click', () => {
        if (!disableClose) {
          this.hide();
        }
        resolve({
          isConfirmed: true,
        });
      });

      this._cancelButtonElement.addEventListener('click', () => {
        if (!disableClose) {
          this.hide();
        }
        resolve({
          isConfirmed: false,
        });
      });

      this.root.addEventListener('click', (event) => {
        if (event.currentTarget === event.target) {
          if (!disableClose) {
            this.hide();
          }
          resolve({
            isConfirmed: false,
          });
        }
      });

      this.root.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          if (!disableEscape) {
            this.hide();
          }
          resolve({
            isConfirmed: false,
          });
        }
      });
    });
  }

  public loading(): void {
    this._iconElement.append(this._loaderElement);
    this.changeState('loading');
    this.show();
  }

  override hide(): void {
    this.#progress = 0;
    this.#html = '';
    this.#label = '';
    this.changeState('hidden');
    super.hide();
  }

  public set label(label: Label) {
    this.#label = label;
    this.render();
  }

  public set html(html: string) {
    this.#html = html;
    this.render();
  }

  public set progress(progress: number) {
    this.#progress = progress;
    this.render();
  }

  private changeState(state: 'loading' | 'alert' | 'hidden'): void {
    this.#state = state;
    const elements = [
      this.root,
      this._actionsElement,
      this._contentElement,
      this._iconElement,
      this._loaderElement,
      this._progressElement,
      this._titleElement,
    ];
    for (const element of elements) {
      element.dataset.state = state;
    }

    this.render();
  }

  override render(): void {
    super.render();

    this._progressElement.style.width = `${this.#progress}%`;

    switch (this.#state) {
      case 'loading':
        break;
      case 'alert':
        this._iconElement.innerHTML = '';
        break;
      case 'hidden':
      default:
        this._iconElement.innerHTML = '';
        break;
    }

    this._titleElement.textContent = this.#title;
    if (this.#html) {
      this._contentElement.innerHTML = this.#html;
    } else {
      if (this.#label instanceof Array) {
        this._contentElement.innerHTML = `<div>${this.#label.join('</div><div>')}</div>`;
      } else {
        this._contentElement.textContent = this.#label;
      }
    }
  }
}
