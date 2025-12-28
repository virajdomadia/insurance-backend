import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@example.com';
  const adminPassword = 'Admin';

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } as any } as any);
  if (existing) {
    console.log(`Admin user with email ${adminEmail} already exists, skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const user = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    } as any,
  } as any);

  console.log('Created admin user:', { id: user.id, email: user.email });
  console.log('IMPORTANT: change the password immediately or delete this seeded user in production');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
