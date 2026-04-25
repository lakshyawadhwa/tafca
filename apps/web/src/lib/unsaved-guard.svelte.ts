import { navigate } from './router.svelte';

export function useUnsavedGuard(isDirty: () => boolean, message?: string) {
  $effect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  });

  return {
    guardedNavigate(to: string) {
      if (isDirty() && !confirm(message ?? 'Discard unsaved changes?')) return;
      navigate(to);
    },
  };
}
