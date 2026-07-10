import {
  IsString, IsOptional, IsNotEmpty, IsBoolean, IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Committee position types (FRS §3.2) ──────────────────────────────────────

export class CreatePositionTypeDto {
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() order?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isLeadership?: boolean;
  @ApiPropertyOptional({ description: 'May approve minutes / close actions' })
  @IsOptional() @IsBoolean() canApprove?: boolean;
}

export class UpdatePositionTypeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() order?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isLeadership?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() canApprove?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

// ─── Designations (FRS §3.3A) ─────────────────────────────────────────────────

export class CreateDesignationDto {
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiProperty() @IsString() @IsNotEmpty() code: string;
}

export class UpdateDesignationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() code?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
