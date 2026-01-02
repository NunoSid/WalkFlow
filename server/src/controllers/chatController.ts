import { Request, Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';

const getThreadKeyForUser = (message: any, userId: string) => {
  if (message.toUserId) {
    const otherId = message.fromUserId === userId ? message.toUserId : message.fromUserId;
    return `USER:${otherId}`;
  }
  if (message.toRole) {
    return `ROLE:${message.toRole}`;
  }
  return 'ROLE:ALL';
};

const decodeThreadKey = (raw: string) => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

export const getChatMessages = async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  if (!user) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }

  const threadKeyFilter = req.query.threadKey ? decodeThreadKey(String(req.query.threadKey)) : null;

  try {
    const [messages, threadStates] = await Promise.all([
      prisma.chatMessage.findMany({
        where: {
          OR: [
            { toRole: 'ALL' },
            { toRole: user.role },
            { toUserId: user.id },
            { fromUserId: user.id },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 500,
        include: {
          fromUser: { select: { id: true, username: true, fullName: true, role: true } },
          toUser: { select: { id: true, username: true, fullName: true, role: true } },
        },
      }),
      prisma.chatThreadState.findMany({
        where: { userId: user.id },
      }),
    ]);

    const stateMap = new Map(threadStates.map((state) => [state.threadKey, state]));

    const filtered = messages.filter((message) => {
      const threadKey = getThreadKeyForUser(message, user.id);
      if (threadKeyFilter && threadKey !== threadKeyFilter) return false;
      const state = stateMap.get(threadKey);
      if (state?.deletedAt && message.createdAt <= state.deletedAt) return false;
      return true;
    }).map((message) => ({
      ...message,
      threadKey: getThreadKeyForUser(message, user.id),
    }));

    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar mensagens.' });
  }
};

export const getChatThreads = async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  if (!user) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }

  try {
    const [messages, threadStates] = await Promise.all([
      prisma.chatMessage.findMany({
        where: {
          OR: [
            { toRole: 'ALL' },
            { toRole: user.role },
            { toUserId: user.id },
            { fromUserId: user.id },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 800,
        include: {
          fromUser: { select: { id: true, username: true, fullName: true, role: true } },
          toUser: { select: { id: true, username: true, fullName: true, role: true } },
        },
      }),
      prisma.chatThreadState.findMany({
        where: { userId: user.id },
      }),
    ]);

    const stateMap = new Map(threadStates.map((state) => [state.threadKey, state]));
    const threadMap = new Map<string, any>();

    messages.forEach((message) => {
      const threadKey = getThreadKeyForUser(message, user.id);
      const state = stateMap.get(threadKey);
      if (state?.deletedAt && message.createdAt <= state.deletedAt) return;

      const existing = threadMap.get(threadKey);
      if (!existing || new Date(message.createdAt) >= new Date(existing.lastMessage.createdAt)) {
        let type = 'ROLE';
        let label = message.toRole || 'ALL';
        let threadUser = null;
        if (threadKey.startsWith('USER:')) {
          type = 'USER';
          const otherId = threadKey.replace('USER:', '');
          const userCandidate = message.fromUser?.id === otherId ? message.fromUser : message.toUser;
          threadUser = userCandidate || null;
          label = userCandidate?.fullName || userCandidate?.username || otherId;
        } else if (threadKey === 'ROLE:ALL') {
          type = 'ALL';
          label = 'Global';
        }

        threadMap.set(threadKey, {
          threadKey,
          type,
          label,
          role: threadKey.startsWith('ROLE:') && threadKey !== 'ROLE:ALL' ? threadKey.replace('ROLE:', '') : null,
          user: threadUser,
          archived: state?.archived ?? false,
          deletedAt: state?.deletedAt ?? null,
          lastMessage: {
            id: message.id,
            message: message.message,
            createdAt: message.createdAt,
            fromUserId: message.fromUserId,
          },
        });
      }
    });

    const threads = Array.from(threadMap.values()).sort((a, b) => (
      new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    ));

    res.json(threads);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar conversas.' });
  }
};

export const archiveChatThread = async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  if (!user) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }

  const threadKey = decodeThreadKey(String(req.params.threadKey || ''));
  const { archived } = req.body || {};
  if (!threadKey) {
    return res.status(400).json({ error: 'Conversa inválida.' });
  }
  if (typeof archived !== 'boolean') {
    return res.status(400).json({ error: 'Valor inválido.' });
  }

  try {
    await prisma.chatThreadState.upsert({
      where: { userId_threadKey: { userId: user.id, threadKey } },
      update: { archived },
      create: { userId: user.id, threadKey, archived },
    });
    res.json({ message: 'Conversa atualizada.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar conversa.' });
  }
};

export const deleteChatThread = async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  if (!user) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }

  const threadKey = decodeThreadKey(String(req.params.threadKey || ''));
  if (!threadKey) {
    return res.status(400).json({ error: 'Conversa inválida.' });
  }

  try {
    await prisma.chatThreadState.upsert({
      where: { userId_threadKey: { userId: user.id, threadKey } },
      update: { deletedAt: new Date(), archived: false },
      create: { userId: user.id, threadKey, deletedAt: new Date(), archived: false },
    });
    res.json({ message: 'Conversa eliminada.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao eliminar conversa.' });
  }
};
