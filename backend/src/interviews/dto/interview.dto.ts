import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
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
  TECHNICAL_TOPICS,
} from '../../ai/interview.constants';
import { SUPPORTED_LANGUAGES } from '../../coding/coding.problems';

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

  /**
   * Only meaningful for TECHNICAL and MIXED interviews (required there; the
   * service enforces it). Restricted to the known topic list because topics
   * are interpolated into the interviewer prompt.
   */
  @IsArray()
  @ArrayMaxSize(TECHNICAL_TOPICS.length)
  @IsIn([...TECHNICAL_TOPICS], { each: true })
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
  @MaxLength(64)
  resumeId?: string;
}

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  content: string;

  /**
   * Client-generated id for this answer. Retrying with the same id after a
   * dropped connection returns the already-saved reply instead of creating a
   * duplicate turn.
   */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{8,64}$/)
  clientMessageId?: string;
}

export class RecordEventDto {
  @IsString()
  @IsIn(['FOCUS_LOST', 'COPY_PASTE', 'FULLSCREEN_EXIT', 'HINT_REQUESTED'])
  type: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class SubmitCodingDto {
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
