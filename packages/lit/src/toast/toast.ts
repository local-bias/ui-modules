import { ToastController } from './controller';
import type { ToastConfig, ToastItem, ToastOptions, ToastTexts } from './types';
import './toast-container';
import type { ToastContainer } from './toast-container';

class ToastSingleton {
  readonly #controller = new ToastController();
  #element: ToastContainer | null = null;

  #ensureElement(): void {
    if (this.#element?.isConnected) return;
    if (typeof document === 'undefined') return;

    const el = document.createElement('toast-container') as ToastContainer;
    el.controller = this.#controller;
    document.body.appendChild(el);
    this.#element = el;
  }

  // ─── Configuration ──────────────────────────────────────

  configure(config: Partial<ToastConfig> & { texts?: ToastTexts }): void {
    this.#controller.configure(config);
  }

  // ─── Show Methods ───────────────────────────────────────

  show(options: ToastOptions): string {
    this.#ensureElement();
    return this.#controller.show(options);
  }

  success(message: string, options?: Omit<ToastOptions, 'type' | 'message'>): string {
    this.#ensureElement();
    return this.#controller.success(message, options);
  }

  error(message: string, options?: Omit<ToastOptions, 'type' | 'message'>): string {
    this.#ensureElement();
    return this.#controller.error(message, options);
  }

  warning(message: string, options?: Omit<ToastOptions, 'type' | 'message'>): string {
    this.#ensureElement();
    return this.#controller.warning(message, options);
  }

  info(message: string, options?: Omit<ToastOptions, 'type' | 'message'>): string {
    this.#ensureElement();
    return this.#controller.info(message, options);
  }

  loading(message: string, options?: Omit<ToastOptions, 'type' | 'message'>): string {
    this.#ensureElement();
    return this.#controller.loading(message, options);
  }

  // ─── Dismiss ────────────────────────────────────────────

  dismiss(id: string): void {
    this.#controller.dismiss(id);
  }

  dismissAll(): void {
    this.#controller.dismissAll();
  }

  // ─── Update ─────────────────────────────────────────────

  update(
    id: string,
    patch: Partial<Pick<ToastItem, 'message' | 'description' | 'type' | 'action'>> & {
      duration?: number;
    }
  ): void {
    this.#controller.update(id, patch);
  }

  // ─── Advanced ───────────────────────────────────────────

  get controller(): ToastController {
    return this.#controller;
  }
}

export const toast = new ToastSingleton();
