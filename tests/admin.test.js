import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import env from '../src/config/env.js';
import UserModel from '../src/models/user.model.js';
import RefreshTokenModel from '../src/models/refreshToken.model.js';
import LoginAttemptModel from '../src/models/loginAttempt.model.js';
import AuditLogModel from '../src/models/auditLog.model.js';

// Helper to generate signed JWT test tokens
const createToken = ({ id, email, role }) => {
  return jwt.sign(
    { sub: id, email, role },
    env.jwtAccessSecret,
    { expiresIn: '15m' }
  );
};

describe('Admin Management Layer & Audit Logging', () => {
  const adminUser = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@example.com',
    passwordHash: 'dummy_hash',
    name: 'Admin User',
    role: 'admin',
  };

  const regularUser = {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'user@example.com',
    passwordHash: 'dummy_hash',
    name: 'Regular User',
    role: 'user',
  };

  const targetUser = {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'target@example.com',
    passwordHash: 'dummy_hash',
    name: 'Target User',
    role: 'user',
  };

  let adminToken;
  let userToken;

  before(async () => {
    adminToken = createToken(adminUser);
    userToken = createToken(regularUser);
  });

  beforeEach(async () => {
    // Clear and re-seed tables for each test
    await AuditLogModel.clearAll();
    await LoginAttemptModel.clearAll();
    await RefreshTokenModel.clearAll();
    await UserModel.clearAll();

    await UserModel.create(adminUser);
    await UserModel.create(regularUser);
    await UserModel.create(targetUser);
  });

  describe('Access Control on Admin Routes (Non-admins get 403, Unauthenticated gets 401)', () => {
    const adminRoutes = [
      { method: 'get', url: '/admin/users' },
      { method: 'post', url: `/admin/users/${targetUser.id}/roles`, body: { role: 'moderator' } },
      { method: 'post', url: `/admin/users/${targetUser.id}/revoke-sessions` },
      { method: 'get', url: `/admin/users/${targetUser.id}/login-history` },
      { method: 'get', url: '/admin/audit-logs' },
    ];

    for (const route of adminRoutes) {
      it(`${route.method.toUpperCase()} ${route.url} should return 401 when token is missing`, async () => {
        let req = request(app)[route.method](route.url);
        if (route.body) req = req.send(route.body);

        const res = await req.expect(401);
        assert.equal(res.body.error, 'Unauthorized');
      });

      it(`${route.method.toUpperCase()} ${route.url} should return 403 Forbidden for non-admin user`, async () => {
        let req = request(app)[route.method](route.url)
          .set('Authorization', `Bearer ${userToken}`);
        if (route.body) req = req.send(route.body);

        const res = await req.expect(403);
        assert.equal(res.body.error, 'Forbidden');
        assert.match(res.body.message, /Requires 'admin' role/i);
      });

      it(`${route.method.toUpperCase()} ${route.url} should allow access (200 OK) for admin user`, async () => {
        let req = request(app)[route.method](route.url)
          .set('Authorization', `Bearer ${adminToken}`);
        if (route.body) req = req.send(route.body);

        const res = await req.expect(200);
        assert.ok(res.body);
      });
    }
  });

  describe('GET /admin/users — List Users & Audit Log', () => {
    it('should list all users with pagination and write an audit log entry', async () => {
      const res = await request(app)
        .get('/admin/users?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assert.equal(res.body.page, 1);
      assert.equal(res.body.limit, 2);
      assert.equal(res.body.total, 3);
      assert.equal(res.body.totalPages, 2);
      assert.equal(res.body.users.length, 2);

      // Verify audit log entry was created
      const logs = await AuditLogModel.list({ limit: 10 });
      const log = logs.find((l) => l.action === 'users_listed');
      assert.ok(log, 'Audit log entry for users_listed should exist');
      assert.equal(log.actor_user_id, adminUser.id);
      assert.equal(log.metadata.page, 1);
      assert.equal(log.metadata.limit, 2);
    });

    it('should filter users by email query parameter', async () => {
      const res = await request(app)
        .get('/admin/users?email=target@example.com')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assert.equal(res.body.users.length, 1);
      assert.equal(res.body.users[0].email, 'target@example.com');
      assert.equal(res.body.total, 1);
    });
  });

  describe('POST /admin/users/:id/roles — Assign/Remove Role & Audit Log', () => {
    it('should assign a new role to user and write role_assigned audit log', async () => {
      const res = await request(app)
        .post(`/admin/users/${targetUser.id}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' })
        .expect(200);

      assert.equal(res.body.user.role, 'admin');

      // Verify updated in database
      const updated = await UserModel.findById(targetUser.id);
      assert.equal(updated.role, 'admin');

      // Verify audit log
      const logs = await AuditLogModel.list({ limit: 10 });
      const log = logs.find((l) => l.action === 'role_assigned');
      assert.ok(log, 'Audit log for role_assigned should be recorded');
      assert.equal(log.actor_user_id, adminUser.id);
      assert.equal(log.target_user_id, targetUser.id);
      assert.equal(log.metadata.role, 'admin');
    });

    it('should remove a role from user and write role_removed audit log', async () => {
      const res = await request(app)
        .post(`/admin/users/${targetUser.id}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'moderator', action: 'remove' })
        .expect(200);

      assert.equal(res.body.user.role, 'user');

      // Verify audit log
      const logs = await AuditLogModel.list({ limit: 10 });
      const log = logs.find((l) => l.action === 'role_removed');
      assert.ok(log, 'Audit log for role_removed should be recorded');
      assert.equal(log.actor_user_id, adminUser.id);
      assert.equal(log.target_user_id, targetUser.id);
    });

    it('should return 404 when target user is not found', async () => {
      const res = await request(app)
        .post('/admin/users/99999999-9999-9999-9999-999999999999/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' })
        .expect(404);

      assert.equal(res.body.error, 'NotFound');
    });
  });

  describe('POST /admin/users/:id/revoke-sessions — Revoke Sessions & Audit Log', () => {
    it('should revoke all active user refresh tokens and write session_revoked audit log', async () => {
      // Seed active refresh token for target user
      await RefreshTokenModel.create({
        userId: targetUser.id,
        tokenHash: 'dummy_hash_123',
        deviceInfo: 'Mozilla/5.0 (Windows NT 10.0)',
        expiresAt: new Date(Date.now() + 86400000),
      });

      const res = await request(app)
        .post(`/admin/users/${targetUser.id}/revoke-sessions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assert.equal(res.body.revokedCount, 1);
      assert.match(res.body.message, /sessions revoked successfully/i);

      // Verify active tokens is now 0
      const active = await RefreshTokenModel.findActiveByUserId(targetUser.id);
      assert.equal(active.length, 0);

      // Verify audit log entry
      const logs = await AuditLogModel.list({ limit: 10 });
      const log = logs.find((l) => l.action === 'session_revoked');
      assert.ok(log, 'Audit log for session_revoked should be recorded');
      assert.equal(log.actor_user_id, adminUser.id);
      assert.equal(log.target_user_id, targetUser.id);
      assert.equal(log.metadata.revokedCount, 1);
    });
  });

  describe('GET /admin/users/:id/login-history — View Login History & Audit Log', () => {
    it('should return recent successful and failed login attempts and write audit log', async () => {
      // Seed login attempts
      await LoginAttemptModel.create({
        userId: targetUser.id,
        email: targetUser.email,
        ipAddress: '192.168.1.10',
        userAgent: 'Chrome/120',
        successful: true,
      });
      await LoginAttemptModel.create({
        userId: targetUser.id,
        email: targetUser.email,
        ipAddress: '192.168.1.11',
        userAgent: 'Firefox/115',
        successful: false,
      });

      const res = await request(app)
        .get(`/admin/users/${targetUser.id}/login-history`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assert.equal(res.body.attempts.length, 2);
      assert.equal(res.body.user.email, targetUser.email);

      // Verify audit log entry
      const logs = await AuditLogModel.list({ limit: 10 });
      const log = logs.find((l) => l.action === 'login_history_viewed');
      assert.ok(log, 'Audit log for login_history_viewed should be recorded');
      assert.equal(log.actor_user_id, adminUser.id);
      assert.equal(log.target_user_id, targetUser.id);
    });
  });

  describe('GET /admin/audit-logs — Paginated & Filterable Audit Logs', () => {
    beforeEach(async () => {
      // Seed audit logs
      await AuditLogModel.create({
        actorUserId: adminUser.id,
        action: 'role_assigned',
        targetUserId: targetUser.id,
        metadata: { role: 'admin' },
      });
      await AuditLogModel.create({
        actorUserId: adminUser.id,
        action: 'session_revoked',
        targetUserId: targetUser.id,
        metadata: { revokedCount: 2 },
      });
      await AuditLogModel.create({
        actorUserId: adminUser.id,
        action: 'users_listed',
        targetUserId: null,
        metadata: { page: 1 },
      });
    });

    it('should return paginated list of all audit logs', async () => {
      const res = await request(app)
        .get('/admin/audit-logs?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assert.equal(res.body.page, 1);
      assert.equal(res.body.limit, 2);
      assert.equal(res.body.total, 3);
      assert.equal(res.body.totalPages, 2);
      assert.equal(res.body.auditLogs.length, 2);

      // Verify audit log schema has all required fields
      const log = res.body.auditLogs[0];
      assert.ok(log.id);
      assert.ok(log.action);
      assert.ok(log.created_at);
      assert.ok('actor_user_id' in log);
      assert.ok('target_user_id' in log);
      assert.ok('metadata' in log);
    });

    it('should filter audit logs by action type', async () => {
      const res = await request(app)
        .get('/admin/audit-logs?action=role_assigned')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assert.equal(res.body.total, 1);
      assert.equal(res.body.auditLogs[0].action, 'role_assigned');
      assert.equal(res.body.auditLogs[0].target_user_id, targetUser.id);
    });

    it('should filter audit logs by date range', async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      const tomorrow = new Date(Date.now() + 86400000).toISOString();

      const res = await request(app)
        .get(`/admin/audit-logs?startDate=${yesterday}&endDate=${tomorrow}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assert.equal(res.body.total, 3);
    });
  });
});
