import { Router } from 'express';
import { login, logout, getMe, register, getAllUsers, changePassword, adminChangePassword, getUserDirectory, deactivateUser } from '../controllers/authController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', authenticateToken, getMe);
router.patch('/password', authenticateToken, changePassword);

// Gestão de Utilizadores (Apenas ADMIN)
router.get('/users', authenticateToken, requireRole(['ADMIN']), getAllUsers);
router.post('/register', authenticateToken, requireRole(['ADMIN']), register);
router.patch('/users/:id/password', authenticateToken, requireRole(['ADMIN']), adminChangePassword);
router.delete('/users/:id', authenticateToken, requireRole(['ADMIN']), deactivateUser);

// Diretório para chat (todos autenticados)
router.get('/directory', authenticateToken, getUserDirectory);

export default router;
