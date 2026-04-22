type ToastVariant = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

let nextId = 0;
let toasts = $state<Toast[]>([]);

export function getToasts() {
  return toasts;
}

export function addToast(message: string, variant: ToastVariant = 'info') {
  const id = nextId++;
  toasts = [...toasts, { id, message, variant }];
  const delay = variant === 'error' ? 6000 : 3000;
  setTimeout(() => removeToast(id), delay);
}

export function removeToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
}
