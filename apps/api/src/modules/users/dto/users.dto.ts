import { IsEmail, IsString, IsEnum, IsOptional, MinLength, Matches, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { UserRole, AppModule } from '@nabh/shared';

export class CreateUserDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty({ minLength: 8 })
  @IsString() @MinLength(8)
  @Matches(/[A-Z]/) @Matches(/[a-z]/) @Matches(/[0-9]/) @Matches(/[^A-Za-z0-9]/)
  password: string;
  @ApiProperty({ enum: UserRole }) @IsEnum(UserRole) role: UserRole;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() designation?: string;
  @ApiPropertyOptional({ type: [String], description: 'Titles — FKs to Designation lookup (drives designation-based committee membership). A user may hold multiple.' })
  @IsOptional() @IsArray() @IsString({ each: true }) designationIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;
  @ApiPropertyOptional({ enum: AppModule, isArray: true })
  @IsOptional() @IsArray() @IsEnum(AppModule, { each: true })
  moduleAccess?: AppModule[];
}

export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['password'] as const)) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() designation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() avatarUrl?: string;
}
