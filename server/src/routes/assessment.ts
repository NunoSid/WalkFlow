import { Router } from 'express';
import { createAssessment } from '../controllers/assessmentController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.post('/', authenticateToken, requireRole(['ENFERMEIRO', 'ADMIN']), createAssessment);

export default router;
