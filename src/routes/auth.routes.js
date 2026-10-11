import { Router } from 'express';
import AuthController from '../controllers/auth.controller.js';
import authenticate from '../middleware/auth.middleware.js';

const router = Router();

// Public routes
router.post('/register', AuthController.register);
router.post('/signup', AuthController.register);
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);

// Google OAuth2 routes
router.get('/google', AuthController.googleAuth);
router.get('/google/callback', AuthController.googleCallback);

// Protected routes
router.get('/me', authenticate, AuthController.me);
router.post('/logout', authenticate, AuthController.logout);
router.post('/logout-all', authenticate, AuthController.logoutAll);

export default router;
