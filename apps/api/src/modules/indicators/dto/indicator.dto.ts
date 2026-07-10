import {
  IsString, IsOptional, IsNotEmpty, IsBoolean, IsEnum, IsInt, IsNumber,
  IsArray, IsObject, Min, Max, ValidateNested, ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IndicatorFramework, IndicatorFormula, IndicatorScope } from '@nabh/shared';

// ─── Indicator Type (the grouping, e.g. "Productivity") ──────────────────────

export class CreateIndicatorTypeDto {
  @ApiProperty({ enum: IndicatorFramework }) @IsEnum(IndicatorFramework) framework: IndicatorFramework;
  @ApiPropertyOptional({ description: '"" for hospital/KPI, else department code (Outcome)' })
  @IsOptional() @IsString() departmentCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() departmentName?: string;
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() order?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateIndicatorTypeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() order?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

// ─── Indicator Template (the "Quality Indicator" definition) ─────────────────

export class CreateIndicatorTemplateDto {
  @ApiProperty() @IsString() @IsNotEmpty() typeId: string;
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() numeratorLabel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() denominatorLabel?: string;
  @ApiProperty({ enum: IndicatorFormula }) @IsEnum(IndicatorFormula) formulaType: IndicatorFormula;
  @ApiPropertyOptional({ description: '1 = ratio, 100 = %, 1000 = per-thousand' })
  @IsOptional() @IsNumber() multiplier?: number;
  @ApiPropertyOptional({ description: 'Expression for CUSTOM formula — variables n, d, m' })
  @IsOptional() @IsString() customExpression?: string;
  @ApiPropertyOptional({ description: 'The indicator formula shown in the UI' })
  @IsOptional() @IsString() formula?: string;
  @ApiPropertyOptional({ description: 'Structured formula: inputs, numerator/denominator, scale' })
  @IsOptional() @IsObject() formulaSpec?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() frequency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sourceOfData?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() significance?: string;
  @ApiPropertyOptional({ description: 'Performance target (enables RAG status)' })
  @IsOptional() @IsNumber() target?: number;
  @ApiPropertyOptional({ description: 'Is a higher value better? (default true)' })
  @IsOptional() @IsBoolean() higherIsBetter?: boolean;
  @ApiPropertyOptional({ enum: IndicatorScope }) @IsOptional() @IsEnum(IndicatorScope) scope?: IndicatorScope;
  @ApiPropertyOptional() @IsOptional() @IsString() departmentCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() departmentName?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() order?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateIndicatorTemplateDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() typeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() numeratorLabel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() denominatorLabel?: string;
  @ApiPropertyOptional({ enum: IndicatorFormula }) @IsOptional() @IsEnum(IndicatorFormula) formulaType?: IndicatorFormula;
  @ApiPropertyOptional() @IsOptional() @IsNumber() multiplier?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() customExpression?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() formula?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() formulaSpec?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() frequency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sourceOfData?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() significance?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() target?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() higherIsBetter?: boolean;
  @ApiPropertyOptional({ enum: IndicatorScope }) @IsOptional() @IsEnum(IndicatorScope) scope?: IndicatorScope;
  @ApiPropertyOptional() @IsOptional() @IsString() departmentCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() departmentName?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() order?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

// ─── Indicator Entry (Admin's monthly data point) ────────────────────────────

export class UpsertIndicatorEntryDto {
  @ApiProperty() @IsString() @IsNotEmpty() templateId: string;
  @ApiProperty() @IsInt() @Min(2000) @Max(2100) year: number;
  @ApiProperty() @IsInt() @Min(1) @Max(12) month: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() numeratorValue?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() denominatorValue?: number;
  @ApiPropertyOptional({ type: [Number] })
  @IsOptional() @IsArray() @IsNumber({}, { each: true }) sampleValues?: number[];
  @ApiPropertyOptional({ description: 'Raw per-variable inputs of the formula calculator, keyed by variable' })
  @IsOptional() @IsObject() inputValues?: Record<string, number>;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class BulkUpsertEntriesDto {
  @ApiProperty({ type: [UpsertIndicatorEntryDto] })
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => UpsertIndicatorEntryDto)
  entries: UpsertIndicatorEntryDto[];
}

// ─── Live compute preview (no persistence) ───────────────────────────────────

export class PreviewComputeDto {
  @ApiProperty({ enum: IndicatorFormula }) @IsEnum(IndicatorFormula) formulaType: IndicatorFormula;
  @ApiPropertyOptional() @IsOptional() @IsNumber() multiplier?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() numeratorValue?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() denominatorValue?: number;
  @ApiPropertyOptional({ type: [Number] })
  @IsOptional() @IsArray() @IsNumber({}, { each: true }) sampleValues?: number[];
  @ApiPropertyOptional() @IsOptional() @IsString() customExpression?: string;
}
