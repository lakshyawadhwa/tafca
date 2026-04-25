import { getUser } from './auth.svelte';

const ENABLED = import.meta.env.VITE_ANALYTICS_ENABLED === 'true';

type EventName =
  | 'client_create_completed'
  | 'engagement_create_completed'
  | 'task_create_completed'
  | 'task_status_changed'
  | 'checklist_item_toggled'
  | 'comment_submitted'
  | 'kanban_drag_completed';

export function track(event: EventName, props: Record<string, string | number | boolean> = {}) {
  if (!ENABLED) return;
  const user = getUser();
  console.info('[track]', event, {
    ...props,
    firm_id: user?.firmId,
    user_id: user?.id,
    ts: new Date().toISOString(),
  });
}
