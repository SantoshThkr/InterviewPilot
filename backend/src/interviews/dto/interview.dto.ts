import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  DIFFICULTY_LEVELS,
  EXPERIENCE_LEVELS,
  INTERVIEW_TYPES,
  PERSONALITIES,
  ROLES,
  TECHNICAL_TOPICS,
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
  code: string;

  @IsString()
  language: string;

  @IsOptional()
  timeSpentSecs?: number;

  @IsOptional()
  hintsUsed?: number;
}
