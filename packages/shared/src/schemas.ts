import { z } from 'zod';
import { Quarter, AssessmentType, AppModule } from './enums';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, 'Minimum 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, 'Minimum 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const createAssessmentSchema = z.object({
  quarter: z.nativeEnum(Quarter),
  year: z.number().int().min(2024).max(2030),
  startDate: z.string().datetime({ offset: true }).or(z.string().date()),
  endDate: z.string().datetime({ offset: true }).or(z.string().date()),
  assessmentDate: z.string().datetime({ offset: true }),
  type: z.nativeEnum(AssessmentType),
  departmentId: z.string().cuid(),
  assesseeName: z.string().min(1),
  assessorNames: z.array(z.string().min(1)).min(1),
  notes: z.string().optional(),
  module: z.nativeEnum(AppModule).optional(),
  institutionAssessmentId: z.string().optional(),
});

export const saveResponsesSchema = z.object({
  sectionCode: z.string().min(1),
  responses: z.array(
    z.object({
      clientCheckpointId: z.string().cuid(),
      clientScore: z.number().int().min(0),
      remarks: z.string().optional(),
    }),
  ),
});

export const reviewAssessmentSchema = z.object({
  remarks: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
export type SaveResponsesInput = z.infer<typeof saveResponsesSchema>;
export type ReviewAssessmentInput = z.infer<typeof reviewAssessmentSchema>;
