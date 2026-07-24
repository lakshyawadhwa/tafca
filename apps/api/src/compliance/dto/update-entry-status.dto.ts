import { IsUUID, IsString, IsNotEmpty, IsEnum, MaxLength } from 'class-validator';
import { ComplianceEntryStatus } from '@ca-practice-os/shared';

/**
 * Compliance calendar entries are computed on read, so most have no DB row yet.
 * The client identifies an entry by its natural key; the server recomputes the
 * authoritative due date for that (deadline, period) and upserts the status.
 */
export class UpdateEntryStatusDto {
  @IsUUID()
  clientId!: string;

  @IsUUID()
  statutoryDeadlineId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  periodLabel!: string;

  @IsEnum(ComplianceEntryStatus)
  status!: ComplianceEntryStatus;
}
