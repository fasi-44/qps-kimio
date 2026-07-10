import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../notifications/mail.service';
import { AssessmentStatus, UserRole, ReviewAction, NotificationType, AppModule } from '@nabh/shared';

@Injectable()
export class ApprovalsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
    private mail: MailService,
  ) {}

  async getPendingApprovals(userId: string, userRole: UserRole) {
    const where: any = { status: AssessmentStatus.SUBMITTED };
    // HOD sees all submitted; Admin sees all
    const [assessments, total] = await Promise.all([
      this.prisma.assessment.findMany({
        where,
        orderBy: { submittedAt: 'asc' },
        include: {
          department: {
            include: {
              clientDepartments: {
                select: { _count: { select: { sections: true } } },
              },
            },
          },
          assessor: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.assessment.count({ where }),
    ]);

    const data = assessments.map((a) => ({
      ...a,
      totalSections: a.department.clientDepartments.reduce(
        (sum, cd) => sum + cd._count.sections,
        0,
      ),
    }));

    return { data, total };
  }

  private async review(
    assessmentId: string,
    action: ReviewAction,
    reviewerId: string,
    remarks?: string,
  ) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        department: true,
        assessor: { select: { id: true, name: true, email: true } },
      },
    });

    if (!assessment) throw new NotFoundException('Assessment not found');
    if (assessment.status !== AssessmentStatus.SUBMITTED) {
      throw new BadRequestException('Only SUBMITTED assessments can be reviewed');
    }

    const statusMap: Record<ReviewAction, AssessmentStatus> = {
      [ReviewAction.APPROVED]: AssessmentStatus.APPROVED,
      [ReviewAction.REJECTED]: AssessmentStatus.REJECTED,
      [ReviewAction.SENT_BACK]: AssessmentStatus.SENT_BACK,
    };

    const newStatus = statusMap[action];
    const updateData: any = { status: newStatus };
    if (action === ReviewAction.APPROVED) updateData.approvedAt = new Date();
    if (action === ReviewAction.REJECTED) updateData.rejectedAt = new Date();

    await this.prisma.$transaction([
      this.prisma.assessment.update({ where: { id: assessmentId }, data: updateData }),
      this.prisma.assessmentReview.create({
        data: { assessmentId, action, module: assessment.module as AppModule, reviewerId, remarks },
      }),
    ]);

    // Notify assessor
    const notifTypeMap = {
      [ReviewAction.APPROVED]: NotificationType.ASSESSMENT_APPROVED,
      [ReviewAction.REJECTED]: NotificationType.ASSESSMENT_REJECTED,
      [ReviewAction.SENT_BACK]: NotificationType.ASSESSMENT_SENT_BACK,
    };

    const labels = {
      [ReviewAction.APPROVED]: 'Approved',
      [ReviewAction.REJECTED]: 'Rejected',
      [ReviewAction.SENT_BACK]: 'Sent Back',
    };

    // Notifications are best-effort — don't let them break the approval response
    try {
      await this.notifications.create({
        userId: assessment.assessorId,
        type: notifTypeMap[action],
        module: assessment.module as AppModule,
        title: `Assessment ${labels[action]}`,
        message: `Your ${assessment.department.name} assessment (${assessment.quarter} ${assessment.year}) has been ${labels[action].toLowerCase()}.${remarks ? ` Remarks: ${remarks}` : ''}`,
        meta: { assessmentId, departmentId: assessment.departmentId },
      });
    } catch {}

    // Email notification
    if (assessment.assessor?.email) {
      await this.mail.sendAssessmentReviewed(
        assessment.assessor.email,
        assessment.assessor.name,
        action,
        assessment.department.name,
        assessment.quarter,
        assessment.year,
        remarks,
      );
    }

    await this.audit.log({
      userId: reviewerId,
      action: `ASSESSMENT_${action}`,
      resource: 'Assessment',
      resourceId: assessmentId,
      newValue: { action, remarks },
    });

    return { message: `Assessment ${labels[action].toLowerCase()}` };
  }

  async approve(assessmentId: string, reviewerId: string, remarks?: string) {
    return this.review(assessmentId, ReviewAction.APPROVED, reviewerId, remarks);
  }

  async reject(assessmentId: string, reviewerId: string, remarks?: string) {
    return this.review(assessmentId, ReviewAction.REJECTED, reviewerId, remarks);
  }

  async sendBack(assessmentId: string, reviewerId: string, remarks?: string) {
    return this.review(assessmentId, ReviewAction.SENT_BACK, reviewerId, remarks);
  }
}
