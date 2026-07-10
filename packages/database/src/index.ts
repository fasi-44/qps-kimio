/**
 * @nabh/database — re-exports Prisma generated client + types
 */
export { PrismaClient, Prisma } from './generated/client/client';
export type {
  User,
  RefreshToken,
  PasswordReset,
  HospitalSettings,
  Department,
  AreaOfConcern,
  Standard,
  MeasurableElement,
  ClientDepartment,
  ClientSection,
  ClientCheckpoint,
  ChecklistMapping,
  Assessment,
  AssessmentResponse,
  AssessmentReview,
  Notification,
  AuditLog,
  IndicatorType,
  IndicatorTemplate,
  IndicatorEntry,
} from './generated/client/client';
export {
  UserRole,
  AssessmentStatus,
  AssessmentType,
  Quarter,
  ScoreMappingType,
  ReviewAction,
  NotificationType,
  IndicatorFramework,
  IndicatorFormula,
  IndicatorScope,
} from './generated/client/client';
