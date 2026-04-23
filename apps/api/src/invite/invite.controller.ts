import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@ca-practice-os/shared';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { InviteService } from './invite.service';

@Controller('invites')
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  @Post()
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async createInvite(@Body() dto: CreateInviteDto) {
    return this.inviteService.createInvite(dto);
  }

  @Get()
  @Roles(UserRole.PARTNER, UserRole.ADMIN, UserRole.MANAGER)
  async listPending() {
    const data = await this.inviteService.listPending();
    return { data };
  }

  @Delete(':id')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@Param('id') id: string) {
    await this.inviteService.revoke(id);
  }

  @Public()
  @Get(':token/preview')
  async preview(@Param('token') token: string) {
    return this.inviteService.preview(token);
  }

  @Public()
  @Post(':token/accept')
  async accept(
    @Param('token') token: string,
    @Body() dto: AcceptInviteDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.inviteService.accept(
      token,
      dto.password,
      ip,
      req.headers['user-agent'],
    );
  }
}
