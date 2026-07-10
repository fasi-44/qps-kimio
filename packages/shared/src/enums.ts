export enum AppModule {
  NQAS = 'NQAS',
  NABH = 'NABH',
  KAYAKALPA = 'KAYAKALPA',
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  HOD = 'HOD',
  ASSESSOR = 'ASSESSOR',
}

// ─── Quality & Patient Safety — KPI / Outcome Indicators ────────────────────

export enum IndicatorFramework {
  KPI = 'KPI',
  OUTCOME = 'OUTCOME',
}

export enum IndicatorFormula {
  RATIO = 'RATIO',
  MEAN = 'MEAN',
  MEDIAN = 'MEDIAN',
  CUSTOM = 'CUSTOM',
}

export enum IndicatorScope {
  HOSPITAL = 'HOSPITAL',
  DEPARTMENT = 'DEPARTMENT',
}

export enum AssessmentStatus {
  DRAFT = 'DRAFT',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SENT_BACK = 'SENT_BACK',
}

export enum AssessmentType {
  INTERNAL = 'INTERNAL',
  EXTERNAL = 'EXTERNAL',
}

export enum Quarter {
  Q1 = 'Q1',
  Q2 = 'Q2',
  Q3 = 'Q3',
  Q4 = 'Q4',
}

export enum ScoreMappingType {
  DIRECT = 'DIRECT',
  PROPORTIONAL = 'PROPORTIONAL',
  CONDITIONAL = 'CONDITIONAL',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

export enum ReviewAction {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SENT_BACK = 'SENT_BACK',
}

export enum NotificationType {
  ASSESSMENT_SUBMITTED = 'ASSESSMENT_SUBMITTED',
  ASSESSMENT_APPROVED = 'ASSESSMENT_APPROVED',
  ASSESSMENT_REJECTED = 'ASSESSMENT_REJECTED',
  ASSESSMENT_SENT_BACK = 'ASSESSMENT_SENT_BACK',
  ASSESSMENT_OVERDUE = 'ASSESSMENT_OVERDUE',
  COMMITTEE_MEETING_SCHEDULED = 'COMMITTEE_MEETING_SCHEDULED',
  AGENDA_DEADLINE = 'AGENDA_DEADLINE',
  MINUTES_PENDING_APPROVAL = 'MINUTES_PENDING_APPROVAL',
  ACTION_OVERDUE = 'ACTION_OVERDUE',
  COMMITTEE_TENURE_EXPIRY = 'COMMITTEE_TENURE_EXPIRY',
  SYSTEM = 'SYSTEM',
}

// ─── Committee Management ───────────────────────────────────────────────────

export enum CommitteeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum MeetingFrequency {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  HALF_YEARLY = 'HALF_YEARLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM',
}

export enum MeetingMode {
  PHYSICAL = 'PHYSICAL',
  ONLINE = 'ONLINE',
  HYBRID = 'HYBRID',
}

export enum MeetingStatus {
  SCHEDULED = 'SCHEDULED',
  RESCHEDULED = 'RESCHEDULED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export enum MembershipType {
  DESIGNATION = 'DESIGNATION',
  NOMINATION = 'NOMINATION',
}

export enum MembershipChangeType {
  ADDED = 'ADDED',
  REMOVED = 'REMOVED',
  REPLACED = 'REPLACED',
  ROLE_CHANGED = 'ROLE_CHANGED',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LEAVE_OF_ABSENCE = 'LEAVE_OF_ABSENCE',
  INVITED_GUEST = 'INVITED_GUEST',
}

export enum AgendaStatus {
  SUBMITTED = 'SUBMITTED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CLARIFICATION_REQUESTED = 'CLARIFICATION_REQUESTED',
  PUBLISHED = 'PUBLISHED',
}

export enum MinutesMethod {
  DIRECT = 'DIRECT',
  UPLOAD = 'UPLOAD',
}

export enum MinutesStatus {
  DRAFT = 'DRAFT',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  PUBLISHED = 'PUBLISHED',
}

export enum ActionStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  PARTIALLY_COMPLETED = 'PARTIALLY_COMPLETED',
  COMPLETED = 'COMPLETED',
  CLOSED = 'CLOSED',
  OVERDUE = 'OVERDUE',
}

export enum ActionPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ActionSource {
  AGENDA = 'AGENDA',
  AUDIT_FINDING = 'AUDIT_FINDING',
  INCIDENT = 'INCIDENT',
  ASSESSMENT = 'ASSESSMENT',
  COMMITTEE_DECISION = 'COMMITTEE_DECISION',
}

export enum CarryForwardDecision {
  CONTINUE = 'CONTINUE',
  MODIFY_DUE_DATE = 'MODIFY_DUE_DATE',
  ESCALATE = 'ESCALATE',
  CLOSE = 'CLOSE',
}

export const COMPLIANCE_THRESHOLDS = {
  EXCELLENT: 80,
  SATISFACTORY: 70,
  PARTIAL: 50,
} as const;

export const SCORE_OPTIONS = {
  NON_COMPLIANT: 0,
  PARTIAL: 1,
  FULLY_COMPLIANT: 2,
} as const;
