import {
  Controller,
  Get,
  Post,
  Patch,
  Query,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRole } from '@ca-practice-os/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import {
  UserResponseDto,
  PaginatedUsersResponseDto,
  DeactivateUserResponseDto,
} from './dto/user-response.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async listUsers(
    @Query() query: ListUsersQueryDto,
  ): Promise<PaginatedUsersResponseDto> {
    return this.userService.listUsers(query);
  }

  @Post()
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createUser(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.userService.createUser(dto);
  }

  @Patch(':id')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.userService.updateUser(id, dto);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.PARTNER, UserRole.ADMIN)
  async deactivateUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeactivateUserResponseDto> {
    return this.userService.deactivateUser(id);
  }
}
