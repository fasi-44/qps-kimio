import {
  IsEnum, IsString, IsDateString, IsOptional, IsNotEmpty, IsBoolean, IsInt, Min, Max, IsArray, ValidateNested, IsUrl, IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MeetingMode, MeetingFrequency, MeetingStatus, AttendanceStatus, RECURRENCE_MAX } from '@nabh/shared';

export class RecurrenceEndDto {
  @ApiProperty({ enum: ['COUNT', 'UNTIL'] }) @IsIn(['COUNT', 'UNTIL']) type: 'COUNT' | 'UNTIL';
  @ApiPropertyOptional({ description: 'When type=COUNT' })
  @IsOptional() @IsInt() @Min(1) @Max(RECURRENCE_MAX) count?: number;
  @ApiPropertyOptional({ description: 'ISO date when type=UNTIL (inclusive)' })
  @IsOptional() @IsDateString() until?: string;
}

export class RecurrenceDto {
  @ApiProperty({ enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] })
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']) freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  @ApiProperty({ description: 'Every N days/weeks/months/years' }) @IsInt() @Min(1) @Max(99) interval: number;

  @ApiPropertyOptional({ description: 'DAILY: every weekday (Mon–Fri)' })
  @IsOptional() @IsBoolean() weekdaysOnly?: boolean;

  @ApiPropertyOptional({ type: [Number], description: 'WEEKLY: 0=Sun … 6=Sat' })
  @IsOptional() @IsArray() @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) byWeekday?: number[];

  @ApiPropertyOptional({ enum: ['DAY_OF_MONTH', 'NTH_WEEKDAY'] })
  @IsOptional() @IsIn(['DAY_OF_MONTH', 'NTH_WEEKDAY']) monthlyMode?: 'DAY_OF_MONTH' | 'NTH_WEEKDAY';
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(31) dayOfMonth?: number;
  @ApiPropertyOptional({ description: '1..4 or -1 (last)' }) @IsOptional() @IsIn([1, 2, 3, 4, -1]) nth?: 1 | 2 | 3 | 4 | -1;
  @ApiPropertyOptional({ enum: ['DAY', 'WEEKDAY', 'WEEKEND_DAY', 'SPECIFIC'] })
  @IsOptional() @IsIn(['DAY', 'WEEKDAY', 'WEEKEND_DAY', 'SPECIFIC']) nthKind?: 'DAY' | 'WEEKDAY' | 'WEEKEND_DAY' | 'SPECIFIC';
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(6) nthWeekday?: number;

  @ApiPropertyOptional({ description: 'YEARLY: 1..12' }) @IsOptional() @IsInt() @Min(1) @Max(12) month?: number;

  @ApiProperty({ type: RecurrenceEndDto }) @ValidateNested() @Type(() => RecurrenceEndDto) end: RecurrenceEndDto;
}

export class MeetingAgendaItemDto {
  @ApiProperty() @IsString() @IsNotEmpty() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true }) supportingDocs?: string[];
}

export class CreateMeetingDto {
  @ApiProperty() @IsString() @IsNotEmpty() title: string;
  @ApiProperty() @IsDateString() scheduledDate: string;
  @ApiPropertyOptional({ description: 'e.g. "15:00"' }) @IsOptional() @IsString() time?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() venue?: string;
  @ApiPropertyOptional({ description: 'Join URL for online/hybrid meetings' })
  @IsOptional() @IsUrl({ require_tld: false }) meetingLink?: string;
  @ApiPropertyOptional({ enum: MeetingMode }) @IsOptional() @IsEnum(MeetingMode) mode?: MeetingMode;
  @ApiPropertyOptional() @IsOptional() @IsDateString() agendaDeadline?: string;

  @ApiPropertyOptional({ description: 'Send email reminders to members' })
  @IsOptional() @IsBoolean() sendEmail?: boolean;
  @ApiPropertyOptional({ description: 'Hours before the meeting to send reminders, e.g. [168, 24, 1]' })
  @IsOptional() @IsArray() @IsInt({ each: true }) @Min(0, { each: true }) reminderOffsets?: number[];
  @ApiPropertyOptional({ description: 'Email template to use for reminders' })
  @IsOptional() @IsString() reminderTemplateId?: string;

  @ApiPropertyOptional({ description: 'Generate a recurring series' })
  @IsOptional() @IsBoolean() isRecurring?: boolean;
  @ApiPropertyOptional({ type: RecurrenceDto, description: 'Outlook-style recurrence pattern + range (preferred when recurring)' })
  @IsOptional() @ValidateNested() @Type(() => RecurrenceDto) recurrence?: RecurrenceDto;

  // Legacy simple recurrence (kept for backward compatibility; `recurrence` takes precedence)
  @ApiPropertyOptional({ enum: MeetingFrequency, description: 'Legacy: required when isRecurring without `recurrence`' })
  @IsOptional() @IsEnum(MeetingFrequency) frequency?: MeetingFrequency;
  @ApiPropertyOptional({ description: 'Legacy: number of occurrences (default 12, max 24)' })
  @IsOptional() @IsInt() @Min(1) @Max(24) occurrences?: number;

  @ApiPropertyOptional({ type: [MeetingAgendaItemDto], description: 'Agenda items created already approved & published' })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MeetingAgendaItemDto)
  agendaItems?: MeetingAgendaItemDto[];
}

export class UpdateMeetingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() scheduledDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() time?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() venue?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_tld: false }) meetingLink?: string;
  @ApiPropertyOptional({ enum: MeetingMode }) @IsOptional() @IsEnum(MeetingMode) mode?: MeetingMode;
  @ApiPropertyOptional() @IsOptional() @IsDateString() agendaDeadline?: string;
  @ApiPropertyOptional({ enum: MeetingStatus }) @IsOptional() @IsEnum(MeetingStatus) status?: MeetingStatus;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() sendEmail?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsInt({ each: true }) @Min(0, { each: true }) reminderOffsets?: number[];
  @ApiPropertyOptional() @IsOptional() @IsString() reminderTemplateId?: string;
}

export class RescheduleMeetingDto {
  @ApiProperty() @IsDateString() scheduledDate: string;
  @ApiPropertyOptional() @IsOptional() @IsString() time?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() venue?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class CancelMeetingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class AttendanceEntryDto {
  @ApiProperty() @IsString() @IsNotEmpty() memberId: string;
  @ApiProperty({ enum: AttendanceStatus }) @IsEnum(AttendanceStatus) status: AttendanceStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;
}

export class SaveAttendanceDto {
  @ApiProperty({ type: [AttendanceEntryDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => AttendanceEntryDto)
  entries: AttendanceEntryDto[];
  @ApiPropertyOptional({ type: [String], description: 'Uploaded signed attendance sheet URLs' })
  @IsOptional() @IsArray() @IsString({ each: true }) attendanceDocs?: string[];
}
