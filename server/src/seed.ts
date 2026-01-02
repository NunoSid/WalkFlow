import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('123456', 10);

  // Admin
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      fullName: 'Administrador do Sistema',
      passwordHash: password,
      role: 'ADMIN'
    }
  });

  // Administrativo (Receção)
  await prisma.user.upsert({
    where: { username: 'rececao' },
    update: {},
    create: {
      username: 'rececao',
      fullName: 'Maria Recepcionista',
      passwordHash: password,
      role: 'ADMINISTRATIVO'
    }
  });

  // Enfermeiro
  await prisma.user.upsert({
    where: { username: 'enf1' },
    update: {},
    create: {
      username: 'enf1',
      fullName: 'Enf. João Silva',
      passwordHash: password,
      role: 'ENFERMEIRO'
    }
  });

  // Médico
  await prisma.user.upsert({
    where: { username: 'med1' },
    update: {},
    create: {
      username: 'med1',
      fullName: 'Dr. António Costa',
      passwordHash: password,
      role: 'MEDICO'
    }
  });

  // Tempos de Espera
  await prisma.user.upsert({
    where: { username: 'te' },
    update: {},
    create: {
      username: 'te',
      fullName: 'Tempos de Espera',
      passwordHash: password,
      role: 'TEMPOS_ESPERA'
    }
  });

  console.log('Seed concluído!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
