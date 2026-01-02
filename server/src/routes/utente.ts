import { Router } from 'express';
import { 
  createUtente, 
  getPendingUtentes, 
  getDoctorUtentes, 
  updateStatus, 
  getHistory, 
  deleteUtente,
  getWaitStats,
  cancelUtente,
  getRecentUtentes,
  startTriage,
  getUtenteReport,
  getRetriageUtentes
} from '../controllers/utenteController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.post('/', authenticateToken, requireRole(['ADMIN', 'ADMINISTRATIVO']), createUtente);
router.get('/pending', authenticateToken, requireRole(['ADMIN', 'ENFERMEIRO']), getPendingUtentes);
router.get('/retriage', authenticateToken, requireRole(['ADMIN', 'ENFERMEIRO']), getRetriageUtentes);
router.get('/doctor', authenticateToken, requireRole(['ADMIN', 'MEDICO']), getDoctorUtentes);
router.patch('/:id/status', authenticateToken, requireRole(['MEDICO', 'ADMIN']), updateStatus);
router.patch('/:id/triage-start', authenticateToken, requireRole(['ENFERMEIRO', 'ADMIN']), startTriage);

// Histórico e Gestão
router.get('/history', authenticateToken, requireRole(['ADMIN', 'MEDICO', 'ADMINISTRATIVO', 'ENFERMEIRO']), getHistory);
router.get('/:id/report', authenticateToken, requireRole(['MEDICO', 'ENFERMEIRO']), getUtenteReport);
router.get('/recent', authenticateToken, getRecentUtentes); // Acessível a todos autenticados
router.get('/stats', authenticateToken, getWaitStats); // Acessível a todos autenticados
router.delete('/:id/cancel', authenticateToken, requireRole(['ADMIN', 'ADMINISTRATIVO']), cancelUtente); // Soft delete
router.delete('/:id', authenticateToken, requireRole(['ADMIN']), deleteUtente); // Hard delete

export default router;
