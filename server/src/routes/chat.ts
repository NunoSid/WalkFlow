import { Router } from 'express';
import { getChatMessages, getChatThreads, archiveChatThread, deleteChatThread } from '../controllers/chatController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/messages', authenticateToken, getChatMessages);
router.get('/threads', authenticateToken, getChatThreads);
router.patch('/threads/:threadKey/archive', authenticateToken, archiveChatThread);
router.delete('/threads/:threadKey', authenticateToken, deleteChatThread);

export default router;
