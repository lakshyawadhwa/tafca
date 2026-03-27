export interface NotificationPreferences {
  in_app: boolean;
  email: boolean;
  whatsapp: boolean;
  muted_until: string | null; // ISO date string or null
}
