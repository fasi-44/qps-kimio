import {
  IsEnum, IsString, IsDateString, IsOptional, IsNotEmpty, IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipType } from '@nabh/shared';

export class AddMemberDto {
  @ApiProperty() @IsString() @IsNotEmpty() positionTypeId: string;
  @ApiProperty({ enum: MembershipType }) @IsEnum(MembershipType) membershipType: MembershipType;
  @ApiPropertyOptional({ description: 'Nominee user (nomination-based)' })
  @IsOptional() @IsString() userId?: string;
  @ApiPropertyOptional({ description: 'Designation (designation-based)' })
  @IsOptional() @IsString() designationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() departmentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nomineeName?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() changeReason?: string;
}

export class UpdateMemberDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() positionTypeId?: string;
  @ApiPropertyOptional({ enum: MembershipType }) @IsOptional() @IsEnum(MembershipType) membershipType?: MembershipType;
  @ApiPropertyOptional() @IsOptional() @IsString() userId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() designationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() departmentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nomineeName?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() changeReason?: string;
}

export class RemoveMemberDto {
  @ApiPropertyOptional() @IsOptional() @IsString() changeReason?: string;
}
