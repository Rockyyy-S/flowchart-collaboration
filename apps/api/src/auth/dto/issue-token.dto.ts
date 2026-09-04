import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { USER_ID_PATTERN } from '../../common/constants/validation-patterns';

export class IssueTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(USER_ID_PATTERN, {
    message: 'userId 仅允许字母、数字、下划线和短横线，长度 2-100',
  })
  userId: string;
}
