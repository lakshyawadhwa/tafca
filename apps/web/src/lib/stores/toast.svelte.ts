export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

const MAX_VISIBLE = 3;

const toastState = $state<{ toasts: Toast[] }>({ toasts: [] });

const dismissTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

export function getToasts(): Toast[] {
  return toastState.toasts;
}

export function addToast(message: string, variant: ToastVariant = 'info'): void {
  const id = crypto.randomUUID();
  const toast: Toast = { id, message, variant };

  toastState.toasts = [toast, ...toastState.toasts].slice(0, MAX_VISIBLE);

  const duration = variant === 'error' ? 8000 : 4000;
  const timeout = setTimeout(() => {
    removeToast(id);
  }, duration);
  dismissTimeouts.set(id, timeout);
}

export function removeToast(id: string): void {
  const timeout = dismissTimeouts.get(id);
  if (timeout) {
    clearTimeout(timeout);
    dismissTimeouts.delete(id);
  }
  toastState.toasts = toastState.toasts.filter((t) => t.id !== id);
}
