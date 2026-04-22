import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FirmScopedService } from '../common/base/firm-scoped.service';
import { UpdateFirmSettingsDto } from './dto/update-firm-settings.dto';
import { UpdateFirmProfileDto } from './dto/update-firm-profile.dto';
import { FirmSettingsResponseDto } from './dto/firm-settings-response.dto';
import { FirmSettings } from '@ca-practice-os/shared';

const DEFAULT_SETTINGS: FirmSettingsResponseDto = {
  default_internal_deadline_buffer_days: 3,
  auto_task_generation_enabled: true,
  require_partner_approval_for: [],
};

@Injectable()
export class FirmSettingsService extends FirmScopedService {
  private readonly logger = new Logger(FirmSettingsService.name);

  async getSettings(): Promise<FirmSettingsResponseDto> {
    const firmId = this.getFirmId();
    const firm = await this.unscopedPrisma.firm.findFirst({
      where: { id: firmId },
      select: { settings: true },
    });

    if (!firm) {
      throw new NotFoundException('Firm not found');
    }

    const settings = (firm.settings as Partial<FirmSettings>) || {};

    return {
      default_internal_deadline_buffer_days:
        settings.default_internal_deadline_buffer_days ?? DEFAULT_SETTINGS.default_internal_deadline_buffer_days,
      auto_task_generation_enabled:
        settings.auto_task_generation_enabled ?? DEFAULT_SETTINGS.auto_task_generation_enabled,
      require_partner_approval_for:
        settings.require_partner_approval_for ?? DEFAULT_SETTINGS.require_partner_approval_for,
    };
  }

  async updateSettings(dto: UpdateFirmSettingsDto): Promise<FirmSettingsResponseDto> {
    const firmId = this.getFirmId();
    const userId = this.getUserId();

    const firm = await this.unscopedPrisma.firm.findFirst({
      where: { id: firmId },
      select: { settings: true },
    });

    if (!firm) {
      throw new NotFoundException('Firm not found');
    }

    const existingSettings = (firm.settings as Partial<FirmSettings>) || {};

    // Merge: only overwrite fields that are present in the dto
    const merged = { ...existingSettings };
    if (dto.default_internal_deadline_buffer_days !== undefined) {
      merged.default_internal_deadline_buffer_days = dto.default_internal_deadline_buffer_days;
    }
    if (dto.auto_task_generation_enabled !== undefined) {
      merged.auto_task_generation_enabled = dto.auto_task_generation_enabled;
    }
    if (dto.require_partner_approval_for !== undefined) {
      merged.require_partner_approval_for = dto.require_partner_approval_for;
    }

    await this.unscopedPrisma.firm.update({
      where: { id: firmId },
      data: {
        settings: merged as any,
        updatedBy: userId,
      },
    });

    return {
      default_internal_deadline_buffer_days:
        merged.default_internal_deadline_buffer_days ?? DEFAULT_SETTINGS.default_internal_deadline_buffer_days,
      auto_task_generation_enabled:
        merged.auto_task_generation_enabled ?? DEFAULT_SETTINGS.auto_task_generation_enabled,
      require_partner_approval_for:
        merged.require_partner_approval_for ?? DEFAULT_SETTINGS.require_partner_approval_for,
    };
  }

  async updateProfile(dto: UpdateFirmProfileDto) {
    const firmId = this.getFirmId();
    const userId = this.getUserId();

    const firm = await this.unscopedPrisma.firm.findFirst({
      where: { id: firmId },
    });

    if (!firm) {
      throw new NotFoundException('Firm not found');
    }

    const data: Record<string, unknown> = { updatedBy: userId };
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.icaiRegistration !== undefined) data.icaiRegistration = dto.icaiRegistration;
    if (dto.pan !== undefined) data.pan = dto.pan;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.email !== undefined) data.email = dto.email;

    const updated = await this.unscopedPrisma.firm.update({
      where: { id: firmId },
      data,
      select: {
        id: true,
        name: true,
        displayName: true,
        icaiRegistration: true,
        pan: true,
        phone: true,
        email: true,
      },
    });

    return updated;
  }

  async getProfile() {
    const firmId = this.getFirmId();

    const firm = await this.unscopedPrisma.firm.findFirst({
      where: { id: firmId },
      select: {
        id: true,
        name: true,
        displayName: true,
        icaiRegistration: true,
        pan: true,
        phone: true,
        email: true,
      },
    });

    if (!firm) {
      throw new NotFoundException('Firm not found');
    }

    return firm;
  }
}
