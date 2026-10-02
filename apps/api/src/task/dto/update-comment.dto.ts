import {
  IsString,
  IsOptional,
  IsArray,
  IsUUID,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { LIMITS } from '@ca-practice-os/shared';
import { TrimmedString } from '../../common/validators/trim.transform';

export class UpdateCommentDto {
  @IsOptional()
  @TrimmedString()
  @IsString()
  @MaxLength(LIMITS.COMMENT_MAX_LENGTH)
  body?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(LIMITS.MAX_MENTIONS_PER_COMMENT)
  mentions?: string[];
}
