import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class DebugController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('/debug/connection-check')
  async connectionCheck() {
    const users = await this.prisma.user.count();
    const beneficiaries = await this.prisma.beneficiary.count();

    return {
      backend: 'ok',
      db: 'ok',
      users,
      beneficiaries,
      env: process.env.NODE_ENV,
    };
  }
}
