import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: config.get('SMTP_HOST', 'smtp.gmail.com'),
      port: config.get<number>('SMTP_PORT', 587),
      secure: false,
      auth: {
        user: config.get('SMTP_USER'),
        pass: config.get('SMTP_PASS'),
      },
    });
  }

  /** Send an already-rendered email (e.g. from a configurable template). Best-effort. */
  async sendRendered(to: string, subject: string, html: string) {
    await this.send(to, subject, html);
  }

  private async send(to: string, subject: string, html: string) {
    try {
      await this.transporter.sendMail({
        from: this.config.get('MAIL_FROM', '"NQAS Platform" <noreply@hospital.com>'),
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${err.message}`);
    }
  }

  async sendPasswordReset(email: string, name: string, resetUrl: string) {
    const html = `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;">
        <h2 style="color:#0A1628;">Password Reset Request</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>A password reset was requested for your NQAS Platform account.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#0EA5E9;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0;">
          Reset Password
        </a>
        <p style="color:#666;font-size:12px;">This link expires in 30 minutes. If you did not request this, ignore this email.</p>
      </div>`;
    await this.send(email, 'Password Reset — NQAS Platform', html);
  }

  async sendAssessmentSubmitted(
    hodEmail: string,
    hodName: string,
    assessorName: string,
    departmentName: string,
    quarter: string,
    year: number,
  ) {
    const html = `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;">
        <h2 style="color:#0A1628;">Assessment Submitted for Review</h2>
        <p>Hello <strong>${hodName}</strong>,</p>
        <p><strong>${assessorName}</strong> has submitted an assessment for your review:</p>
        <ul>
          <li><strong>Department:</strong> ${departmentName}</li>
          <li><strong>Period:</strong> ${quarter} ${year}</li>
        </ul>
        <p>Please login to the NQAS Platform to review and approve/reject.</p>
      </div>`;
    await this.send(hodEmail, `Assessment Submitted — ${departmentName} ${quarter} ${year}`, html);
  }

  async sendAssessmentReviewed(
    assessorEmail: string,
    assessorName: string,
    action: 'APPROVED' | 'REJECTED' | 'SENT_BACK',
    departmentName: string,
    quarter: string,
    year: number,
    remarks?: string,
  ) {
    const colors = { APPROVED: '#22C55E', REJECTED: '#EF4444', SENT_BACK: '#F59E0B' };
    const labels = { APPROVED: 'Approved', REJECTED: 'Rejected', SENT_BACK: 'Sent Back for Revision' };
    const html = `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;">
        <h2 style="color:${colors[action]};">Assessment ${labels[action]}</h2>
        <p>Hello <strong>${assessorName}</strong>,</p>
        <p>Your assessment has been <strong style="color:${colors[action]};">${labels[action]}</strong>:</p>
        <ul>
          <li><strong>Department:</strong> ${departmentName}</li>
          <li><strong>Period:</strong> ${quarter} ${year}</li>
          ${remarks ? `<li><strong>Remarks:</strong> ${remarks}</li>` : ''}
        </ul>
        ${action === 'SENT_BACK' ? '<p>Please login to review the feedback and resubmit.</p>' : ''}
      </div>`;
    await this.send(
      assessorEmail,
      `Assessment ${labels[action]} — ${departmentName} ${quarter} ${year}`,
      html,
    );
  }
}
