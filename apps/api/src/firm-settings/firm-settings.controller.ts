import { Controller, Get, Patch, Body } from '@nestjs/common';
import { FirmSettingsService } from './firm-settings.service';
import { UpdateFirmSettingsDto } from './dto/update-firm-settings.dto';
import { FirmSettingsResponseDto } from './dto/firm-settings-response.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@ca-practice-os/shared';

@Controller('firms/settings')
export class FirmSettingsController {
  constructor(private readonly firmSettingsService: FirmSettingsService) {}

  @Get()
  async getSettings(): Promise<FirmSettingsResponseDto> {
    return this.firmSettingsService.getSettings();
  }

  @Patch()
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async updateSettings(
    @Body() dto: UpdateFirmSettingsDto,
  ): Promise<FirmSettingsResponseDto> {
    return this.firmSettingsService.updateSettings(dto);
  }
}
