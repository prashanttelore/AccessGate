import { Router } from 'express';
import AdminController from '../controllers/admin.controller.js';
import authenticate from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/rbac.middleware.js';

const router = Router();

// Protect ALL admin routes with JWT authentication and admin role check
router.use(authenticate, requireAdmin);

// GET /admin/users — list all users with pagination, filterable by email
router.get('/users', AdminController.getUsers);

// POST /admin/users/:id/roles — assign/remove a role from a user
router.post('/users/:id/roles', AdminController.updateRoles);

// POST /admin/users/:id/revoke-sessions — force logout-all for a specific user
router.post('/users/:id/revoke-sessions', AdminController.revokeUserSessions);

// GET /admin/users/:id/login-history — view recent login attempts for a user
router.get('/users/:id/login-history', AdminController.getLoginHistory);

// GET /admin/audit-logs — paginated list of audit logs, filterable by action and date range
router.get('/audit-logs', AdminController.getAuditLogs);

export default router;
