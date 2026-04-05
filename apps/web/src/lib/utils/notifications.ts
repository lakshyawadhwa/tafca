import {
  Bell,
  UserPlus,
  ClipboardCheck,
  RotateCcw,
  Unlock,
  AtSign,
} from 'lucide-svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NOTIFICATION_ICON_MAP: Record<string, any> = {
  TASK_ASSIGNED: UserPlus,
  TASK_REVIEW_REQUESTED: ClipboardCheck,
  TASK_APPROVAL_REQUESTED: ClipboardCheck,
  TASK_SENT_BACK: RotateCcw,
  TASK_DEPENDENCY_UNBLOCKED: Unlock,
  COMMENT_MENTION: AtSign,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getNotificationIcon(type: string): any {
  return NOTIFICATION_ICON_MAP[type] ?? Bell;
}

export function getNotificationRoute(
  entityType?: string | null,
  entityId?: string | null,
): string | null {
  if (!entityType || !entityId) return null;

  const ROUTE_MAP: Record<string, string> = {
    Task: `/tasks/${entityId}`,
    Client: `/clients/${entityId}`,
    Engagement: `/engagements/${entityId}`,
  };

  return ROUTE_MAP[entityType] ?? null;
}
