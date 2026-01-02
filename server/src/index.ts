import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import prisma from './prisma';

import { initSocket } from './socket';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Inicializar Socket.io
const io = initSocket(server);

// Configuração CORS
const corsOptions = {
  origin: (origin: any, callback: any) => {
    callback(null, true);
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json({ limit: '25mb' }));
app.use(cookieParser());

io.on('connection', (socket) => {
  console.log('Novo cliente conectado:', socket.id);

  const { userId, role, username } = socket.handshake.auth || {};
  if (userId) {
    socket.join(`user:${userId}`);
  }
  if (role) {
    socket.join(`role:${role}`);
  }
  socket.join('role:ALL');
  
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });

  socket.on('chat_message', async (payload) => {
    try {
      const message = String(payload?.message || '').trim();
      if (!message) return;

      const toRole = payload?.toRole || null;
      const toUserId = payload?.toUserId || null;
      const senderId = userId || payload?.fromUserId;
      if (!senderId) return;

      const saved = await prisma.chatMessage.create({
        data: {
          fromUserId: senderId,
          toRole: toUserId ? null : (toRole || 'ALL'),
          toUserId: toUserId || null,
          message,
        },
        include: {
          fromUser: { select: { id: true, username: true, fullName: true, role: true } },
          toUser: { select: { id: true, username: true, fullName: true, role: true } },
        },
      });

      if (toUserId) {
        io.to(`user:${toUserId}`).emit('chat_message', saved);
        io.to(`user:${senderId}`).emit('chat_message', saved);
      } else if (toRole && toRole !== 'ALL') {
        io.to(`role:${toRole}`).emit('chat_message', saved);
        io.to(`user:${senderId}`).emit('chat_message', saved);
      } else {
        io.to('role:ALL').emit('chat_message', saved);
      }
    } catch (error) {
      console.error('Chat error', error);
    }
  });

  socket.on('urgent_alert', (payload) => {
    const message = String(payload?.message || 'ATENÇÃO IMEDIATA');
    const fromUserName = payload?.fromUserName || payload?.fromUserId || '';
    io.to('role:MEDICO').emit('urgent_alert', { message, fromUserName });
  });

  socket.on('urgent_alert_clear', () => {
    io.to('role:MEDICO').emit('urgent_alert_clear');
  });
});

// Health check


import authRoutes from './routes/auth';
import utenteRoutes from './routes/utente';
import assessmentRoutes from './routes/assessment';
import auditRoutes from './routes/audit';
import chatRoutes from './routes/chat';
import settingsRoutes from './routes/settings';

// ... (after middleware)

app.use('/api/auth', authRoutes);
app.use('/api/utentes', utenteRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/settings', settingsRoutes);

const PORT = process.env.PORT || 3000;

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Servidor a correr na porta ${PORT} (0.0.0.0)`);
});
