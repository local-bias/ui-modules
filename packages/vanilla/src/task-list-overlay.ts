import { css } from '@emotion/css';
import { Overlay } from './overlay';

type Label = string | string[];
type TaskStatus = 'new' | 'in-progress' | 'done' | 'error';
type Task = {
  key: string;
  label: Label;
  status: TaskStatus;
};

type ConstructorProps = Readonly<Partial<{ taskList: Task[] }>>;

export class TaskListOverlay extends Overlay {
  #taskList: Task[];

  protected readonly _contentElement: HTMLDivElement;

  public constructor(props: ConstructorProps = {}) {
    super();

    this.#taskList = props.taskList ?? [];

    const container = document.createElement('div');
    container.classList.add(this.containerStyle);
    this.root.append(container);

    const contentElement = document.createElement('div');
    this._contentElement = contentElement;
    contentElement.classList.add(this.contentStyle);
    container.append(contentElement);

    this.render();
  }

  override hide(): void {
    this.#taskList = [];
    super.hide();
  }

  public done(key: string): void {
    const task = this.#taskList.find((t) => t.key === key);
    if (task) {
      task.status = 'done';
      this.render();
    }
  }

  public error(key: string): void {
    const task = this.#taskList.find((t) => t.key === key);
    if (task) {
      task.status = 'error';
      this.render();
    }
  }

  public inProgress(key: string): void {
    const task = this.#taskList.find((t) => t.key === key);
    if (task) {
      task.status = 'in-progress';
      this.render();
    }
  }

  public addTask(...tasks: { key: string; label: Label }[]): void {
    this.#taskList.push(...tasks.map<Task>(({ key, label }) => ({ key, label, status: 'new' })));
    this.render();
  }

  override render(): void {
    super.render();

    this._contentElement.innerHTML = `
      <div class="${this.taskListContainerStyle}">
        ${this.#taskList.map((task) => this.renderTask(task)).join('')}
      </div>
    `;
  }

  private renderTask(task: Task): string {
    const label = Array.isArray(task.label) ? task.label.join(' ') : task.label;
    const status = task.status;

    return `
      <div class="${this.taskContainerStyle}">
        <div class="${this.taskStatusStyle} status-${status}">${this.getTaskStatusElement(
      task.status
    )}</div>
        <div class="${this.taskLabelStyle}">${label}</div>
      </div>
    `;
  }

  private getTaskStatusElement(status: TaskStatus): string {
    switch (status) {
      case 'new':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="#ddd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus-circle"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line></svg>`;
      case 'in-progress':
        return `<div><div></div></div>`;
      case 'done':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="#80beaf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-check-circle"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
      default:
        return ``;
    }
  }

  private containerStyle = css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 32px;
    padding: 32px 64px;
    background-color: #fffc;
    border-radius: 8px;
    box-shadow: 0 5px 24px -6px #0002;
    width: 300px;
    max-width: 90vw;
    min-height: 200px;
    position: relative;
    overflow: hidden;
    transition: all 250ms ease;

    @keyframes spin {
      0% {
        transform: rotate(0deg);
        border-radius: 1em;
      }
      20% {
        transform: rotate(0deg);
      }
      30%,
      60% {
        border-radius: 0.25em;
      }
      70% {
        transform: rotate(180deg);
      }
      100% {
        transform: rotate(180deg);
        border-radius: 1em;
      }
    }
  `;

  private contentStyle = css`
    width: 100%;
  `;

  private taskListContainerStyle = css`
    display: flex;
    flex-direction: column;
    gap: 1em;
    width: 100%;
  `;

  private taskContainerStyle = css`
    display: flex;
    align-items: center;
    gap: 1em;
  `;

  private taskLabelStyle = css``;

  private taskStatusStyle = css`
    font-size: 32px;
    width: 1em;
    height: 1em;
    display: flex;
    justify-content: center;
    align-items: center;

    &.status-new {
    }

    &.status-in-progress {
      border-radius: 50%;
      box-shadow: inset 0 0 0 1px #3b82f633;
      position: relative;
      animation: rotate 1.2s infinite linear;
      > div {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 0.5em;
        height: 1em;
        margin-left: -0.5em;
        margin-top: -0.5em;
        overflow: hidden;
        transform-origin: 0.5em 0.5em;
        mask-image: linear-gradient(top, #000f, #0000);
        -webkit-mask-image: -webkit-linear-gradient(top, #000f, #0000);

        > div {
          width: 1em;
          height: 1em;
          border-radius: 50%;
          box-shadow: inset 0 0 0 1px #3b82f6;
        }
      }
      @keyframes rotate {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
    }
  `;
}
