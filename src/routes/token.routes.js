import { Router } from 'express';
import TokenController from '../controllers/token.controller.js';

const router = Router();

// POST /token/introspect
router.post('/introspect', TokenController.introspect);

export default router;
