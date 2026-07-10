import {
  IsString, IsOptional, IsNotEmpty, IsArray, IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgendaStatus } from '@nabh/shared';

export class SubmitAgendaDto {
  @ApiProperty() @IsString() @IsNotEmpty() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ type: [String], description: 'Uploaded document URLs' })
  @IsOptional() @IsArray() @IsString({ each: true }) supportingDocs?: string[];
}

export class UpdateAgendaDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true }) supportingDocs?: string[];
}

const REVIEW_OUTCOMES = [
  AgendaStatus.ACCEPTED, AgendaStatus.REJECTED, AgendaStatus.CLARIFICATION_REQUESTED,
] as const;

export class ReviewAgendaDto {
  @ApiProperty({ enum: REVIEW_OUTCOMES })
  @IsIn(REVIEW_OUTCOMES as unknown as string[]) decision: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reviewComment?: string;
}
