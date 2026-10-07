import UserModel from '../models/user.model.js';
import RefreshTokenModel from '../models/refreshToken.model.js';
import LoginAttemptModel from '../models/loginAttempt.model.js';
import AuditService from '../services/audit.service.js';

/**
 * Admin Controller
 * Handles administrative user management and audit log inspection
 */
export const AdminController = {
  /**
   * GET /admin/users
   * List all users with pagination, filterable by email (admin only)
   */
  async getUsers(req, res, next) {
    try {
      const page = Math.max(1, parseInt(req.query.page || '1', 10));
      const limit = Math.max(1, parseInt(req.query.limit || '10', 10));
      const email = req.query.email ? String(req.query.email).trim() : null;

      const [users, total] = await Promise.all([
        UserModel.list({ page, limit, email }),
        UserModel.count({ email }),
      ]);

      const totalPages = Math.max(1, Math.ceil(total / limit));

      // Record audit log for admin action
      await AuditService.log({
        actorUserId: req.user?.sub || null,
        action: 'users_listed',
        targetUserId: null,
        metadata: {
          page,
          limit,
          emailFilter: email,
          resultCount: users.length,
        },
      });

      res.status(200).json({
        users,
        page,
        limit,
        total,
        totalPages,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /admin/users/:id/roles
   * Assign or remove a role from a user (admin only)
   */
  async updateRoles(req, res, next) {
    try {
      const { id } = req.params;
      const { role, action = 'assign' } = req.body;

      if (!role && !req.body.roles) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Role is required in request body',
        });
      }

      const targetRole = role || (Array.isArray(req.body.roles) ? req.body.roles[0] : 'user');
      const targetUser = await UserModel.findById(id);

      if (!targetUser) {
        return res.status(404).json({
          error: 'NotFound',
          message: 'User not found',
        });
      }

      const isRemoval = action === 'remove' || action === 'delete';
      const newRole = isRemoval ? 'user' : targetRole;
      const auditAction = isRemoval ? 'role_removed' : 'role_assigned';

      const updatedUser = await UserModel.updateRole(id, newRole);

      // Record audit log for role change
      await AuditService.log({
        actorUserId: req.user?.sub || null,
        action: auditAction,
        targetUserId: id,
        metadata: {
          role: targetRole,
          action: isRemoval ? 'remove' : 'assign',
          previousRole: targetUser.role,
          newRole,
        },
      });

      res.status(200).json({
        message: `Role '${targetRole}' ${isRemoval ? 'removed from' : 'assigned to'} user successfully`,
        user: updatedUser,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /admin/users/:id/revoke-sessions
   * Force logout-all for a specific user (admin only)
   */
  async revokeUserSessions(req, res, next) {
    try {
      const { id } = req.params;
      const targetUser = await UserModel.findById(id);

      if (!targetUser) {
        return res.status(404).json({
          error: 'NotFound',
          message: 'User not found',
        });
      }

      const revoked = await RefreshTokenModel.revokeAllForUser(id);
      const revokedCount = Array.isArray(revoked) ? revoked.length : 0;

      // Record audit log for session revocation
      await AuditService.log({
        actorUserId: req.user?.sub || null,
        action: 'session_revoked',
        targetUserId: id,
        metadata: {
          revokedCount,
          targetEmail: targetUser.email,
        },
      });

      res.status(200).json({
        message: 'All sessions revoked successfully',
        revokedCount,
        userId: id,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /admin/users/:id/login-history
   * View recent login attempts (successful + failed) for a user (admin only)
   */
  async getLoginHistory(req, res, next) {
    try {
      const { id } = req.params;
      const targetUser = await UserModel.findById(id);

      if (!targetUser) {
        return res.status(404).json({
          error: 'NotFound',
          message: 'User not found',
        });
      }

      const limit = Math.max(1, parseInt(req.query.limit || '50', 10));
      const attempts = await LoginAttemptModel.getByUserIdOrEmail(targetUser.id, targetUser.email, limit);

      // Record audit log for viewing login history
      await AuditService.log({
        actorUserId: req.user?.sub || null,
        action: 'login_history_viewed',
        targetUserId: id,
        metadata: {
          attemptsRetrieved: attempts.length,
          targetEmail: targetUser.email,
        },
      });

      res.status(200).json({
        user: {
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
        },
        attempts,
        loginHistory: attempts,
        total: attempts.length,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /admin/audit-logs
   * Paginated list of audit logs, filterable by action type and date range (admin only)
   */
  async getAuditLogs(req, res, next) {
    try {
      const page = req.query.page || 1;
      const limit = req.query.limit || 10;
      const action = req.query.action || null;
      const startDate = req.query.startDate || req.query.start_date || req.query.from || null;
      const endDate = req.query.endDate || req.query.end_date || req.query.to || null;

      const result = await AuditService.getLogs({
        page,
        limit,
        action,
        startDate,
        endDate,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
};

export default AdminController;
