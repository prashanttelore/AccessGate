import { Router } from 'express';
import { getHealth, getReadiness } from '../controllers/health.controller.js';

const router = Router();

// Health check endpoint - returns { status: "ok" }
router.get('/', getHealth);

// Detailed dependency readiness check
router.get('/ready', getReadiness);

export default router;
