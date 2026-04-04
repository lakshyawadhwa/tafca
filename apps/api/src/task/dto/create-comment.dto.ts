import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsUUID,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { LIMITS } from '@ca-practice-os/shared';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(LIMITS.COMMENT_MAX_LENGTH)
  body!: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(LIMITS.MAX_MENTIONS_PER_COMMENT)
  mentions?: string[];

  @IsOptional()
  @IsUUID()
  parentCommentId?: string;
}
