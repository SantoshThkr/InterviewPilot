import { IsString, MaxLength, MinLength } from 'class-validator';

export class RunCodeDto {
  @IsString()
  problemId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  code: string;

  @IsString()
  language: string;
}
