import {
  IsString, IsOptional, IsNotEmpty, IsArray, IsEnum, IsIn, IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActionPriority, ActionSource, ActionStatus, CarryForwardDecision } from '@nabh/shared';

export class CreateActionDto {
  @ApiProperty() @IsString() @IsNotEmpty() description: string;
  @ApiPropertyOptional() @IsOptional() @IsString() meetingId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agendaItemId?: string;
  @ApiPropertyOptional({ enum: ActionSource }) @IsOptional() @IsEnum(ActionSource) source?: ActionSource;
  @ApiPropertyOptional() @IsOptional() @IsString() responsibleUserId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;
  @ApiPropertyOptional({ enum: ActionPriority }) @IsOptional() @IsEnum(ActionPriority) priority?: ActionPriority;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() targetCompletionDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;
}

export class UpdateActionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() responsibleUserId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;
  @ApiPropertyOptional({ enum: ActionPriority }) @IsOptional() @IsEnum(ActionPriority) priority?: ActionPriority;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() targetCompletionDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;
}

const PROGRESS_STATUSES = [
  ActionStatus.OPEN, ActionStatus.IN_PROGRESS, ActionStatus.PARTIALLY_COMPLETED, ActionStatus.COMPLETED,
] as const;

export class UpdateActionStatusDto {
  @ApiProperty({ enum: PROGRESS_STATUSES })
  @IsIn(PROGRESS_STATUSES as unknown as string[]) status: string;
  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;
}

export class AddEvidenceDto {
  @ApiProperty({ type: [String] })
  @IsArray() @IsString({ each: true }) evidenceUrls: string[];
}

export class CloseReopenDto {
  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
}

export class CarryForwardDto {
  @ApiPropertyOptional({ description: 'Target meeting to carry the item into' })
  @IsOptional() @IsString() toMeetingId?: string;
  @ApiProperty({ enum: CarryForwardDecision })
  @IsEnum(CarryForwardDecision) decision: CarryForwardDecision;
  @ApiPropertyOptional() @IsOptional() @IsDateString() newDueDate?: string;
}
