export interface FirmSettings {
  default_internal_deadline_buffer_days: number;
  auto_task_generation_enabled: boolean;
  whatsapp_notifications_enabled: boolean;
  compliance_calendar_auto_populate: boolean;
  require_partner_approval_for: string[];
}
