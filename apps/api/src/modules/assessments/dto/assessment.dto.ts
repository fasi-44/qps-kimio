import {
  IsEnum, IsInt, IsString, IsDateString, IsArray, IsOptional, IsNotEmpty, Min, Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Quarter, AssessmentType, AppModule } from '@nabh/shared';

export class CreateAssessmentDto {
  @ApiProperty({ enum: Quarter }) @IsEnum(Quarter) quarter: Quarter;
  @ApiProperty() @IsInt() @Min(2024) @Max(2035) year: number;
  @ApiProperty() @IsDateString() startDate: string;
  @ApiProperty() @IsDateString() endDate: string;
  @ApiProperty() @IsDateString() assessmentDate: string;
  @ApiProperty({ enum: AssessmentType }) @IsEnum(AssessmentType) type: AssessmentType;
  @ApiPropertyOptional({ enum: AppModule }) @IsOptional() @IsEnum(AppModule) module?: AppModule;
  @ApiProperty() @IsString() @IsNotEmpty() departmentId: string;
  @ApiProperty() @IsString() @IsNotEmpty() assesseeName: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) assessorNames: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() institutionAssessmentId?: string;
}

export class SaveSectionResponsesDto {
  @ApiProperty() @IsString() @IsNotEmpty() sectionCode: string;
  @ApiProperty()
  @IsArray()
  responses: {
    clientCheckpointId: string;
    clientScore: number;
    remarks?: string;
    usedMethod?: string;
  }[];
}

export class UpdateAssessmentNotesDto {
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() strengths?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() recommendations?: string;
}
