import { Request, Response } from 'express';
import { differenceInYears } from 'date-fns';
import prisma from '../prisma';
import { Prisma } from '@prisma/client';
import { getIO } from '../socket';
import { AuthRequest } from '../middleware/auth';

export const createUtente = async (req: Request, res: Response) => {
  try {
    const { name, dob, age, gender, contact, processNumber } = req.body;
    
    if (!name || !processNumber) {
      return res.status(400).json({ error: 'Nome e Nº Processo são obrigatórios.' });
    }

    const parsedDob = dob ? new Date(dob) : null;
    const computedAge = parsedDob ? differenceInYears(new Date(), parsedDob) : null;

    const utente = await prisma.utente.create({
      data: {
        name,
        dob: parsedDob,
        age: computedAge ?? (age ? parseInt(age) : null),
        gender,
        contact,
        processNumber,
        status: 'AGUARDANDO_PRE_AVALIACAO'
      }
    });

    // @ts-ignore
    const userId = req.user?.id;
    await prisma.auditLog.create({
      data: { userId, action: 'CREATE_UTENTE', targetId: utente.id, details: `Utente ${name} criado.` }
    });

    getIO().emit('new_utente', { message: 'Novo utente para Pré-Avaliação', utenteId: utente.id });

    res.status(201).json(utente);
  } catch (error: any) {
    console.error("Erro detalhado:", error);
    res.status(500).json({ error: 'Erro interno ao criar utente. Verifique o terminal.' });
  }
};

export const getPendingUtentes = async (req: Request, res: Response) => {
  try {
    const utentes = await prisma.utente.findMany({
      where: { status: 'AGUARDANDO_PRE_AVALIACAO' },
      orderBy: { arrivalTime: 'asc' }
    });
    res.json(utentes);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar utentes.' });
  }
};

export const getDoctorUtentes = async (req: Request, res: Response) => {
  try {
    const utentes = await prisma.utente.findMany({
      where: { status: 'AGUARDANDO_MEDICO' },
      include: { assessments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    const colorWeight: Record<string, number> = { 'VERMELHO': 1, 'AMARELO': 2, 'VERDE': 3 };

    const sorted = [...utentes].sort((a, b) => {
      const colorA = a.assessments[0]?.color || 'VERDE';
      const colorB = b.assessments[0]?.color || 'VERDE';
      
      if (colorWeight[colorA] !== colorWeight[colorB]) {
        return colorWeight[colorA] - colorWeight[colorB];
      }
      const timeA = new Date(a.assessments[0]?.createdAt || 0).getTime();
      const timeB = new Date(b.assessments[0]?.createdAt || 0).getTime();
      return timeA - timeB;
    });

    const completed = await prisma.utente.findMany({
      where: { status: 'ENCERRADO', completedAt: { not: null } },
      orderBy: { completedAt: 'desc' },
      take: 50,
      include: { assessments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    const avgService = (() => {
      const samples = completed
        .map((u) => {
          const assessment = u.assessments[0];
          if (!assessment || !u.completedAt) return null;
          const minutes = (new Date(u.completedAt).getTime() - new Date(assessment.createdAt).getTime()) / 60000;
          return minutes > 0 ? minutes : null;
        })
        .filter((v): v is number => v !== null);
      if (!samples.length) return 10;
      const total = samples.reduce((acc, value) => acc + value, 0);
      return Math.max(5, Math.round(total / samples.length));
    })();

    const staffCount = await prisma.user.count({
      where: { role: 'ENFERMEIRO', isActive: true },
    });
    const denominator = staffCount > 0 ? staffCount : 1;

    const enriched = sorted.map((u, index) => {
      const triageStartAt = u.triageStartAt ? new Date(u.triageStartAt).getTime() : null;
      const arrivalTime = new Date(u.arrivalTime).getTime();
      const individualWait = triageStartAt ? Math.round((triageStartAt - arrivalTime) / 60000) : null;
      const waitEstimate = Math.round((index * avgService) / denominator);
      return {
        ...u,
        individualWait,
        waitEstimate,
      };
    });

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar lista médica.' });
  }
};

export const getRetriageUtentes = async (req: Request, res: Response) => {
  try {
    const utentes = await prisma.utente.findMany({
      where: { status: 'AGUARDANDO_MEDICO' },
      orderBy: { arrivalTime: 'asc' },
      include: { assessments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    res.json(utentes);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar utentes para re-triagem.' });
  }
};

export const startTriage = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const existing = await prisma.utente.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Utente não encontrado.' });
    if (existing.triageStartAt) return res.json({ triageStartAt: existing.triageStartAt });
    const utente = await prisma.utente.update({
      where: { id },
      data: { triageStartAt: { set: new Date() } },
    });
    res.json({ triageStartAt: utente.triageStartAt });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao iniciar triagem.' });
  }
};

export const updateStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  // @ts-ignore
  const userId = req.user?.id;

  try {
    const utente = await prisma.utente.update({
      where: { id },
      data: { 
        status,
        doctorId: status === 'EM_ATENDIMENTO' ? userId : undefined,
        completedAt: status === 'ENCERRADO' ? new Date() : undefined
      }
    });
    
    getIO().emit('status_update', { utenteId: id, status });
    
    await prisma.auditLog.create({
      data: { userId, action: 'UPDATE_STATUS', targetId: id, details: `Novo estado: ${status}` }
    });

    res.json(utente);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar estado.' });
  }
};

export const getHistory = async (req: Request, res: Response) => {
  const { search, date } = req.query;
  const user = (req as AuthRequest).user;
  const canViewClinical = user && (user.role === 'MEDICO' || user.role === 'ENFERMEIRO');

  try {
    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: String(search) } },
        { processNumber: { contains: String(search) } }
      ];
    }

    if (date) {
      const d = new Date(String(date));
      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + 1);
      
      where.arrivalTime = {
        gte: d,
        lt: nextDay
      };
    }

    const include = canViewClinical
      ? { assessments: { orderBy: { createdAt: Prisma.SortOrder.desc }, take: 1 } }
      : undefined;
    const utentes = await prisma.utente.findMany({
      where,
      orderBy: { arrivalTime: 'desc' },
      ...(include ? { include } : {}),
    });

    res.json(utentes);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
};

export const getUtenteReport = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const utente = await prisma.utente.findUnique({
      where: { id },
      include: {
        assessments: {
          orderBy: { createdAt: 'asc' },
          include: { nurse: { select: { id: true, fullName: true, username: true } } },
        },
      },
    });
    if (!utente) {
      return res.status(404).json({ error: 'Utente não encontrado.' });
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: { targetId: id },
      orderBy: { timestamp: 'asc' },
      include: { user: { select: { id: true, fullName: true, username: true, role: true } } },
    });

    res.json({ utente, auditLogs });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar relatório.' });
  }
};

export const deleteUtente = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.assessment.deleteMany({ where: { utenteId: id } });
    await prisma.utente.delete({ where: { id } });
    // @ts-ignore
    const userId = req.user?.id;
    await prisma.auditLog.create({
      data: { userId, action: 'DELETE_UTENTE', targetId: id, details: 'Utente apagado.' }
    });
    res.json({ message: 'Utente apagado.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao apagar utente.' });
  }
};

// NOVAS FUNÇÕES EXPORTADAS EXPLICITAMENTE

export const cancelUtente = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.utente.update({
      where: { id },
      data: { status: 'CANCELADO' as any }
    });
    getIO().emit('status_update', { utenteId: id, status: 'CANCELADO' });
    // @ts-ignore
    const userId = req.user?.id;
    await prisma.auditLog.create({
      data: { userId, action: 'CANCEL_UTENTE', targetId: id, details: 'Utente cancelado.' }
    });
    res.json({ message: 'Utente cancelado.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao cancelar utente.' });
  }
};

export const getWaitStats = async (req: Request, res: Response) => {
  try {
    const preAssessment = await prisma.utente.findMany({
      where: { status: 'AGUARDANDO_PRE_AVALIACAO' },
      select: { arrivalTime: true },
    });

    const activeUtentes = await prisma.utente.findMany({
      where: { status: 'AGUARDANDO_MEDICO' },
      include: { assessments: { orderBy: { createdAt: 'desc' }, take: 1 } }
    });

    const waits: any = { VERMELHO: 0, AMARELO: 0, VERDE: 0 };
    const counts: any = { VERMELHO: 0, AMARELO: 0, VERDE: 0 };
    const now = Date.now();

    const preWaits = preAssessment
      .map((u) => (now - new Date(u.arrivalTime).getTime()) / 60000)
      .filter((minutes) => minutes >= 0);
    const preAvg = preWaits.length
      ? Math.round(preWaits.reduce((acc, value) => acc + value, 0) / preWaits.length)
      : 0;

    const doctorWaits: number[] = [];
    activeUtentes.forEach(u => {
      const color = u.assessments[0]?.color;
      if (color && counts[color] !== undefined) {
        const waitTime = (now - new Date(u.assessments[0].createdAt).getTime()) / 60000;
        waits[color] = Math.max(waits[color], waitTime);
        counts[color]++;
        doctorWaits.push(waitTime);
      }
    });

    const finalStats = [
      { color: 'VERMELHO', wait: counts.VERMELHO ? Math.round(waits.VERMELHO) : 0, count: counts.VERMELHO },
      { color: 'AMARELO', wait: counts.AMARELO ? Math.round(waits.AMARELO) : 0, count: counts.AMARELO },
      { color: 'VERDE', wait: counts.VERDE ? Math.round(waits.VERDE) : 0, count: counts.VERDE },
    ];

    const doctorAvg = doctorWaits.length
      ? Math.round(doctorWaits.reduce((acc, value) => acc + value, 0) / doctorWaits.length)
      : 0;

    res.json({
      preAssessment: { avgWait: preAvg, count: preAssessment.length },
      doctor: { avgWait: doctorAvg, count: activeUtentes.length, byColor: finalStats },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao calcular estatísticas.' });
  }
};

export const getRecentUtentes = async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const canViewClinical = user && (user.role === 'MEDICO' || user.role === 'ENFERMEIRO');
  try {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const include = canViewClinical
      ? { assessments: { orderBy: { createdAt: Prisma.SortOrder.desc }, take: 1 } }
      : undefined;
    const utentes = await prisma.utente.findMany({
      where: {
        arrivalTime: { gte: sixHoursAgo }
      },
      orderBy: { arrivalTime: 'desc' },
      ...(include ? { include } : {}),
    });
    res.json(utentes);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar recentes.' });
  }
};
