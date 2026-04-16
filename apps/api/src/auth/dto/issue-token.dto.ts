import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class IssueTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  userId: string;
}
