import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../notifications/mail.service';
import { LoginDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from './dto/auth.dto';
import { JwtPayload, UserRole } from '@nabh/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private auditService: AuditService,
    private mailService: MailService,
  ) {}

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email, deletedAt: null },
    });

    if (!user || !user.isActive) {
      await this.auditService.log({
        action: 'LOGIN_FAILED',
        resource: 'User',
        ipAddress: ip,
        userAgent,
        newValue: { email: dto.email, reason: 'User not found or inactive' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      await this.auditService.log({
        userId: user.id,
        action: 'LOGIN_FAILED',
        resource: 'User',
        resourceId: user.id,
        ipAddress: ip,
        userAgent,
        newValue: { reason: 'Wrong password' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const roleModules = await this.getRoleModules(user.role as UserRole);
    const tokens = await this.generateTokens(user.id, user.email, user.role, roleModules);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'LOGIN',
      resource: 'User',
      resourceId: user.id,
      ipAddress: ip,
      userAgent,
    });

    const { password: _, ...safeUser } = user;
    return { user: safeUser, ...tokens };
  }

  async logout(userId: string, refreshToken: string, ip?: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { userId, token: refreshToken },
    });

    await this.auditService.log({
      userId,
      action: 'LOGOUT',
      resource: 'User',
      resourceId: userId,
      ipAddress: ip,
    });

    return { message: 'Logged out successfully' };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: { userId, token: refreshToken, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!storedToken || !storedToken.user.isActive) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: delete old, issue new
    await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });

    const roleModules = await this.getRoleModules(storedToken.user.role as UserRole);
    const tokens = await this.generateTokens(
      storedToken.user.id,
      storedToken.user.email,
      storedToken.user.role,
      roleModules,
    );

    return tokens;
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email, deletedAt: null, isActive: true },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return { message: 'If that email exists, a reset link has been sent.' };
    }

    // Invalidate old tokens
    await this.prisma.passwordReset.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await this.prisma.passwordReset.create({
      data: { token, userId: user.id, expiresAt },
    });

    const resetUrl = `${this.config.get('FRONTEND_URL')}/reset-password?token=${token}`;
    await this.mailService.sendPasswordReset(user.email, user.name, resetUrl);

    return { message: 'If that email exists, a reset link has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const reset = await this.prisma.passwordReset.findUnique({
      where: { token: dto.token },
      include: { user: true },
    });

    if (!reset || reset.used || reset.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashed = await bcrypt.hash(dto.password, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: { password: hashed, passwordChangedAt: new Date() },
      }),
      this.prisma.passwordReset.update({
        where: { id: reset.id },
        data: { used: true },
      }),
      // Invalidate all refresh tokens
      this.prisma.refreshToken.deleteMany({ where: { userId: reset.userId } }),
    ]);

    await this.auditService.log({
      userId: reset.userId,
      action: 'PASSWORD_RESET',
      resource: 'User',
      resourceId: reset.userId,
    });

    return { message: 'Password reset successfully. Please login.' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const match = await bcrypt.compare(dto.currentPassword, user.password);
    if (!match) throw new BadRequestException('Current password is incorrect');

    const hashed = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed, passwordChangedAt: new Date() },
    });

    // Invalidate refresh tokens (force re-login on other devices)
    await this.prisma.refreshToken.deleteMany({ where: { userId } });

    await this.auditService.log({
      userId,
      action: 'PASSWORD_CHANGED',
      resource: 'User',
      resourceId: userId,
    });

    return { message: 'Password changed successfully. Please login again.' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        designation: true,
        department: true,
        avatarUrl: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, data: { name?: string; phone?: string; designation?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true, email: true, name: true, role: true,
        phone: true, designation: true, department: true,
      },
    });
    return user;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async getRoleModules(role: UserRole): Promise<string[]> {
    const perm = await this.prisma.rolePermission.findUnique({ where: { role } });
    return (perm?.moduleAccess ?? ['NQAS']) as string[];
  }

  private async generateTokens(userId: string, email: string, role: string, modules: string[] = []) {
    const payload: JwtPayload = { sub: userId, email, role: role as any, modules: modules as any };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', '1h'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);

    // Store refresh token
    const expiresAt = new Date();
    const days = parseInt(this.config.get('JWT_REFRESH_EXPIRES_IN', '7d').replace('d', ''));
    expiresAt.setDate(expiresAt.getDate() + days);

    await this.prisma.refreshToken.create({
      data: { token: refreshToken, userId, expiresAt },
    });

    return { accessToken, refreshToken };
  }
}
