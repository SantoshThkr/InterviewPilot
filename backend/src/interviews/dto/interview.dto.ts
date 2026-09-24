import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  DIFFICULTY_LEVELS,
  EXPERIENCE_LEVELS,
  INTERVIEW_TYPES,
  PERSONALITIES,
  ROLES,
} from '../../ai/interview.constants';

export class CreateInterviewDto {
  @IsString()
  @IsIn([...ROLES])
  role: string;

  @IsString()
  @IsIn([...EXPERIENCE_LEVELS])
  experience: string;

  @IsString()
  @IsIn([...INTERVIEW_TYPES])
  type: string;

  @IsString()
  @IsIn([...DIFFICULTY_LEVELS])
  difficulty: string;

  @IsString()
  @IsIn([...PERSONALITIES])
  personality: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  topics: string[];

  @IsOptional()
  @IsBoolean()
  includeCoding?: boolean;

  @IsOptional()
  @IsBoolean()
  includeResume?: boolean;

  @IsOptional()
  @IsBoolean()
  examMode?: boolean;

  @IsOptional()
  @IsString()
  resumeId?: string;
}

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  content: string;
}

export class RecordEventDto {
  @IsString()
  @IsIn(['FOCUS_LOST', 'COPY_PASTE', 'FULLSCREEN_EXIT', 'HINT_REQUESTED'])
  type: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class SubmitCodingDto {
  @IsString()
  problemId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  code: string;

  @IsString()
  language: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86_400)
  timeSpentSecs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  hintsUsed?: number;
}
