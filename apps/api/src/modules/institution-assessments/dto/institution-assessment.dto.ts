import {
  IsEnum, IsInt, IsString, IsDateString, IsArray, IsOptional, IsNotEmpty, Min, Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Quarter, AssessmentType, AppModule } from '@nabh/shared';

export class CreateInstitutionAssessmentDto {
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiProperty({ enum: Quarter }) @IsEnum(Quarter) quarter: Quarter;
  @ApiProperty() @IsInt() @Min(2024) @Max(2035) year: number;
  @ApiProperty() @IsDateString() startDate: string;
  @ApiProperty() @IsDateString() endDate: string;
  @ApiProperty() @IsDateString() assessmentDate: string;
  @ApiProperty({ enum: AssessmentType }) @IsEnum(AssessmentType) type: AssessmentType;
  @ApiPropertyOptional({ enum: AppModule }) @IsOptional() @IsEnum(AppModule) module?: AppModule;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) assessorNames?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
