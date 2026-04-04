import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { EngagementTypeService } from './engagement-type.service';

@Controller('engagement-types')
export class EngagementTypeController {
  constructor(private readonly engagementTypeService: EngagementTypeService) {}

  @Get()
  async listEngagementTypes() {
    return this.engagementTypeService.listEngagementTypes();
  }

  @Get(':id/template')
  async getTemplatePreview(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.engagementTypeService.getTemplatePreview(id);
  }
}
