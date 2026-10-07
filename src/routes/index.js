import { Router } from 'express';
import authRoutes from './auth.routes.js';
import adminRoutes from './admin.routes.js';
import healthRoutes from './health.routes.js';
import tokenRoutes from './token.routes.js';
import { authLimiter, adminLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();

router.use('/auth', authLimiter, authRoutes);
router.use('/admin', adminLimiter, adminRoutes);
router.use('/token', tokenRoutes);
router.use('/health', healthRoutes);

export default router;
