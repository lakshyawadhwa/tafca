export interface FirmSettingsResponseDto {
  default_internal_deadline_buffer_days: number;
  auto_task_generation_enabled: boolean;
  require_partner_approval_for: string[];
}
