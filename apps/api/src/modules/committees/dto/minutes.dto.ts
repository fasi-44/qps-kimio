import {
  IsString, IsOptional, IsArray, IsEnum, IsIn, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MinutesMethod } from '@nabh/shared';

export class MinuteEntryDto {
  @ApiPropertyOptional({ description: 'Agenda item this entry relates to (null = general)' })
  @IsOptional() @IsString() agendaItemId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() discussionSummary?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() decisions?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() recommendations?: string;
}

export class SaveMinutesDto {
  @ApiProperty({ enum: MinutesMethod }) @IsEnum(MinutesMethod) method: MinutesMethod;
  @ApiPropertyOptional({ description: 'Uploaded MoM document URL (UPLOAD method)' })
  @IsOptional() @IsString() fileUrl?: string;
  @ApiPropertyOptional({ type: [MinuteEntryDto], description: 'Structured entries (DIRECT method)' })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MinuteEntryDto)
  entries?: MinuteEntryDto[];
}

const TRANSITIONS = ['SUBMIT', 'APPROVE', 'PUBLISH', 'SEND_BACK'] as const;

export class TransitionMinutesDto {
  @ApiProperty({ enum: TRANSITIONS })
  @IsIn(TRANSITIONS as unknown as string[]) action: string;
  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
}
