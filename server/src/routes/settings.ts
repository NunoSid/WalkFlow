import { Router } from 'express';
import { getPublicSettings, updateClinicName, updateSettings } from '../controllers/settingsController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.get('/public', getPublicSettings);
router.patch('/clinic-name', authenticateToken, requireRole(['ADMIN']), updateClinicName);
router.patch('/', authenticateToken, requireRole(['ADMIN']), updateSettings);

export default router;
