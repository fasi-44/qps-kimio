import { UserRole, AppModule, AssessmentStatus, Quarter, AssessmentType } from './enums';

export interface JwtPayload {
  sub: string;      // userId
  email: string;
  role: UserRole;
  modules: AppModule[];
  iat?: number;
  exp?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ScoreBreakdown {
  departmentCode: string;
  departmentName: string;
  quarter: Quarter;
  year: number;
  areas: AreaScore[];
  totalObtained: number;
  totalMax: number;
  compliancePct: number;
  complianceStatus: 'excellent' | 'satisfactory' | 'partial' | 'non_compliant';
}

export interface AreaScore {
  areaCode: string;
  areaName: string;
  obtained: number;
  max: number;
  pct: number;
}

export interface QuarterlyTrend {
  quarter: Quarter;
  year: number;
  compliancePct: number;
  status: AssessmentStatus;
}

export interface DashboardStats {
  totalAssessments: number;
  pendingApprovals: number;
  approvedThisQuarter: number;
  overallCompliancePct: number;
  departmentScores: DepartmentScoreSummary[];
  quarterlyTrends: QuarterlyTrend[];
}

export interface DepartmentScoreSummary {
  departmentCode: string;
  departmentName: string;
  latestCompliancePct: number;
  latestStatus: AssessmentStatus | null;
  quarter: Quarter | null;
  year: number | null;
}

export interface AssessmentMeta {
  quarter: Quarter;
  year: number;
  startDate: string;
  endDate: string;
  assessmentDate: string;
  type: AssessmentType;
  departmentId: string;
  assesseeName: string;
  assessorNames: string[];
}

export type ScoreColor = 'green' | 'amber' | 'red';

export function getScoreColor(pct: number): ScoreColor {
  if (pct >= 80) return 'green';
  if (pct >= 70) return 'amber';
  return 'red';
}
