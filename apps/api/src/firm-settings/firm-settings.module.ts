import { Module } from '@nestjs/common';
import { FirmSettingsService } from './firm-settings.service';
import { FirmSettingsController } from './firm-settings.controller';

@Module({
  controllers: [FirmSettingsController],
  providers: [FirmSettingsService],
})
export class FirmSettingsModule {}
