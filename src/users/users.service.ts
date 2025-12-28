import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User, UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    if (!email) return null;
    return (this.prisma as any).user.findUnique({ where: { email } }) as any;
  }

  async create(data: { email: string; passwordHash: string; role?: UserRole }) {
    return (this.prisma as any).user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role ?? 'CITIZEN',
      },
    }) as any;
  }

  async findById(id: string) {
    return (this.prisma as any).user.findUnique({ where: { id } }) as any;
  }

  async setRole(userId: string, role: UserRole) {
    return (this.prisma as any).user.update({ where: { id: userId }, data: { role } });
  }

  async setActive(userId: string, isActive: boolean) {
    return (this.prisma as any).user.update({ where: { id: userId }, data: { isActive } });
  }

  async list() {
    return (this.prisma as any).user.findMany({ orderBy: { createdAt: 'desc' } }) as any;
  }
}
