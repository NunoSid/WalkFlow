import { Request, Response } from 'express';
import prisma from '../prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000 // 8 horas
    });

    res.json({ user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao fazer login.' });
  }
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ message: 'Logout com sucesso.' });
};

export const getMe = (req: Request, res: Response) => {
  // @ts-ignore - user adicionado pelo middleware
  const user = req.user; 
  if (!user) return res.status(401).json({ error: 'Não autenticado.' });
  res.json({ user });
};

// Obter todos os utilizadores (Apenas Admin)
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, fullName: true, role: true, isActive: true, createdAt: true }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar utilizadores.' });
  }
};

export const getUserDirectory = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, username: true, fullName: true, role: true },
      orderBy: { fullName: 'asc' },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar diretório.' });
  }
};

// Criar novo utilizador (Apenas Admin)
export const register = async (req: Request, res: Response) => {
  const { username, password, fullName, role } = req.body;

  try {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return res.status(400).json({ error: 'Nome de utilizador já existe.' });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        fullName,
        role
      }
    });

    res.status(201).json({ message: 'Utilizador criado com sucesso.', userId: user.id });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar utilizador.' });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  // @ts-ignore
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Não autenticado.' });
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Dados incompletos.' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Utilizador não encontrado.' });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(400).json({ error: 'Password atual inválida.' });
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await prisma.auditLog.create({
      data: { userId, action: 'CHANGE_PASSWORD', targetId: userId, details: 'Alterou a própria password.' }
    });
    res.json({ message: 'Password atualizada.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar password.' });
  }
};

export const adminChangePassword = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  // @ts-ignore
  const adminId = req.user?.id;
  if (!newPassword) return res.status(400).json({ error: 'Password inválida.' });
  try {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id }, data: { passwordHash } });
    await prisma.auditLog.create({
      data: { userId: adminId, action: 'RESET_PASSWORD', targetId: id, details: 'Reset de password pelo admin.' }
    });
    res.json({ message: 'Password atualizada.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar password.' });
  }
};

export const deactivateUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  // @ts-ignore
  const adminId = req.user?.id;
  if (adminId === id) {
    return res.status(400).json({ error: 'Não é possível eliminar o próprio utilizador.' });
  }
  try {
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    await prisma.auditLog.create({
      data: { userId: adminId, action: 'DEACTIVATE_USER', targetId: id, details: 'Utilizador desativado.' }
    });
    res.json({ message: 'Utilizador desativado.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao eliminar utilizador.' });
  }
};
