import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.get('/logs', authenticateToken, requireRole(['ADMIN']), getAuditLogs);

export default router;
