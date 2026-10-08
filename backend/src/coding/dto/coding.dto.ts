import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { SUPPORTED_LANGUAGES } from '../coding.problems';

export class RunCodeDto {
  @IsString()
  @MaxLength(64)
  problemId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  code: string;

  @IsString()
  @IsIn([...SUPPORTED_LANGUAGES])
  language: string;
}
