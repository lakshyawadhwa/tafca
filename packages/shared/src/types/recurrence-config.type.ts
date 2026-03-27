export interface RecurrenceConfig {
  frequency: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUALLY';
  day_of_month: number;
  month_of_quarter?: number;
  advance_create_days: number;
  auto_assign: boolean;
}
