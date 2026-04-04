import { IsUUID, IsNotEmpty } from 'class-validator';

export class CreateDependencyDto {
  @IsUUID()
  @IsNotEmpty()
  dependsOnTaskId!: string;
}
