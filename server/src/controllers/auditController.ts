import { Request, Response } from 'express';
import prisma from '../prisma';

export const getAuditLogs = async (req: Request, res: Response) => {
  const { userId, action, start, end, utente } = req.query;

  try {
    const where: any = {};
    if (userId) where.userId = String(userId);
    if (action) where.action = String(action);
    if (start || end) {
      where.timestamp = {};
      if (start) where.timestamp.gte = new Date(String(start));
      if (end) where.timestamp.lte = new Date(String(end));
    }

    if (utente) {
      const term = String(utente);
      const utentes = await prisma.utente.findMany({
        where: {
          OR: [
            { name: { contains: term } },
            { processNumber: { contains: term } },
          ],
        },
        select: { id: true },
        take: 200,
      });
      where.targetId = { in: utentes.map((u) => u.id) };
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      include: { user: { select: { id: true, username: true, fullName: true, role: true } } },
      take: 500,
    });

    const targetIds = Array.from(new Set(logs.map((log) => log.targetId).filter(Boolean))) as string[];
    const utenteMap = new Map<string, { id: string; name: string; processNumber: string }>();
    if (targetIds.length) {
      const utentes = await prisma.utente.findMany({
        where: { id: { in: targetIds } },
        select: { id: true, name: true, processNumber: true },
      });
      utentes.forEach((u) => utenteMap.set(u.id, u));
    }

    res.json(logs.map((log) => ({
      ...log,
      utente: log.targetId ? utenteMap.get(log.targetId) || null : null,
    })));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar auditorias.' });
  }
};
