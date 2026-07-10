import {
  IsEnum, IsString, IsDateString, IsOptional, IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MeetingFrequency, CommitteeStatus, AppModule } from '@nabh/shared';

export class CreateCommitteeDto {
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() purpose?: string;
  @ApiPropertyOptional({ enum: MeetingFrequency }) @IsOptional() @IsEnum(MeetingFrequency) frequency?: MeetingFrequency;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiryDate?: string;
  @ApiPropertyOptional({ enum: AppModule }) @IsOptional() @IsEnum(AppModule) module?: AppModule;
}

export class UpdateCommitteeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() purpose?: string;
  @ApiPropertyOptional({ enum: MeetingFrequency }) @IsOptional() @IsEnum(MeetingFrequency) frequency?: MeetingFrequency;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiryDate?: string;
}

export class UpdateCommitteeStatusDto {
  @ApiProperty({ enum: CommitteeStatus }) @IsEnum(CommitteeStatus) status: CommitteeStatus;
}
