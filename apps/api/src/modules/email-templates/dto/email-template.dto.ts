import {
  IsString, IsOptional, IsNotEmpty, IsBoolean, IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const EMAIL_TEMPLATE_CATEGORIES = ['MEETING_REMINDER', 'GENERAL'] as const;

export class CreateEmailTemplateDto {
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiProperty() @IsString() @IsNotEmpty() subject: string;
  @ApiProperty({ description: 'HTML body — supports {{placeholders}}' })
  @IsString() @IsNotEmpty() body: string;
  @ApiPropertyOptional({ enum: EMAIL_TEMPLATE_CATEGORIES })
  @IsOptional() @IsIn(EMAIL_TEMPLATE_CATEGORIES as unknown as string[]) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateEmailTemplateDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() subject?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() body?: string;
  @ApiPropertyOptional({ enum: EMAIL_TEMPLATE_CATEGORIES })
  @IsOptional() @IsIn(EMAIL_TEMPLATE_CATEGORIES as unknown as string[]) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
