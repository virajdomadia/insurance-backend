import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    public prisma: PrismaService,
  ) {}

  // Register: only email + password allowed. Role forced to CITIZEN.
  async register(email: string, password: string) {
    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new ForbiddenException('Email already registered');
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.usersService.create({ email, passwordHash });
    return user;
  }

  // Validate credentials and return user (including passwordHash) for login flow
  async validateCredentials(email: string, password: string) {
    const user = await (this.prisma as any).user.findUnique({ where: { email } });
    if (!user) return null;
    if (!(user as any).isActive) throw new ForbiddenException('User is deactivated');
    const match = await bcrypt.compare(password, (user as any).passwordHash);
    if (!match) return null;
    return user as any;
  }

  // Issue access token
  async issueAccessToken(user: { id: string; role: string }) {
    const payload = { sub: user.id, role: user.role };
    const expiresIn = process.env.ACCESS_TOKEN_EXPIRES || '15m';
    return this.jwtService.signAsync(payload, { expiresIn: expiresIn as any } as any);
  }

  // Create and persist refresh token tied to user
  async createRefreshToken(userId: string, expiresInDays = 14) {
    const token = randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    await (this.prisma as any).refreshToken.create({ data: { token, userId, expiresAt } });
    return { token, expiresAt };
  }

  // Validate refresh token exists and not expired
  async validateRefreshToken(token: string) {
    const record = await (this.prisma as any).refreshToken.findUnique({ where: { token } });
    if (!record) return null;
    if (record.expiresAt < new Date()) return null;
    return record;
  }

  // Revoke refresh token
  async revokeRefreshToken(token: string) {
    await (this.prisma as any).refreshToken.deleteMany({ where: { token } });
  }

  // Revoke all tokens for a user (admin logout all)
  async revokeAllForUser(userId: string) {
    await (this.prisma as any).refreshToken.deleteMany({ where: { userId } });
  }
}
