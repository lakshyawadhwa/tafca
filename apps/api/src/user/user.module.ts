import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [SessionModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
