import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import env from '../src/config/env.js';
import UserModel from '../src/models/user.model.js';
import AuthService from '../src/services/auth.service.js';
import { AccessGate } from '../packages/accessgate-sdk/src/index.js';
import shopgApp from '../examples/shopg-service/server.js';

describe('AccessGate SDK & Token Introspection Suite', () => {
  const testAdmin = {
    id: '00000000-0000-0000-0000-000000000010',
    email: 'sdk-admin@example.com',
    passwordHash: 'dummy_hash',
    name: 'SDK Admin',
    role: 'admin',
  };

  const testUser = {
    id: '00000000-0000-0000-0000-000000000020',
    email: 'sdk-user@example.com',
    passwordHash: 'dummy_hash',
    name: 'SDK User',
    role: 'user',
  };

  let adminToken;
  let userToken;

  const createToken = (user, secret = env.jwtAccessSecret, expiresIn = '15m') => {
    return jwt.sign(
      { sub: user.id, email: user.email, role: user.role, roles: [user.role] },
      secret,
      { expiresIn }
    );
  };

  before(async () => {
    await UserModel.create(testAdmin);
    await UserModel.create(testUser);

    adminToken = createToken(testAdmin);
    userToken = createToken(testUser);
  });

  describe('POST /token/introspect Endpoint on AccessGate', () => {
    it('should return active: true with user id, roles, and permissions for valid token', async () => {
      const res = await request(app)
        .post('/token/introspect')
        .send({ token: adminToken })
        .expect(200);

      assert.equal(res.body.active, true);
      assert.equal(res.body.sub, testAdmin.id);
      assert.equal(res.body.user.email, testAdmin.email);
      assert.ok(Array.isArray(res.body.roles));
      assert.ok(res.body.roles.includes('admin'));
      assert.ok(Array.isArray(res.body.permissions));
      assert.ok(res.body.permissions.includes('*'));
    });

    it('should return active: false for invalid or malformed token', async () => {
      const res = await request(app)
        .post('/token/introspect')
        .send({ token: 'malformed.jwt.token' })
        .expect(200);

      assert.equal(res.body.active, false);
      assert.match(res.body.error, /invalid/i);
    });

    it('should return active: false for expired token', async () => {
      const expiredToken = createToken(testUser, env.jwtAccessSecret, '-1s');
      const res = await request(app)
        .post('/token/introspect')
        .send({ token: expiredToken })
        .expect(200);

      assert.equal(res.body.active, false);
      assert.match(res.body.error, /expired/i);
    });

    it('should return active: false when token is revoked in Redis blacklist', async () => {
      const tempToken = createToken(testUser);
      // Revoke token
      await AuthService.revokeToken(tempToken, 300);

      const res = await request(app)
        .post('/token/introspect')
        .send({ token: tempToken })
        .expect(200);

      assert.equal(res.body.active, false);
      assert.match(res.body.error, /revoked/i);
    });
  });

  describe('AccessGate SDK Client & Middleware Verification', () => {
    let localSdk;

    before(() => {
      // Initialize local verification SDK
      localSdk = new AccessGate({
        jwtSecret: env.jwtAccessSecret,
        cacheTtlMs: 0,
      });
    });

    it('should verify token locally when configured with jwtSecret', async () => {
      const result = await localSdk.introspect(adminToken);
      assert.equal(result.active, true);
      assert.equal(result.sub, testAdmin.id);
      assert.ok(result.roles.includes('admin'));
    });

    it('requireAuth should allow valid tokens and attach req.user', async () => {
      const mockReq = { headers: { authorization: `Bearer ${userToken}` } };
      let nextCalled = false;
      const mockRes = {
        status: (code) => ({ json: (d) => d }),
      };

      const mw = localSdk.requireAuth();
      await mw(mockReq, mockRes, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.ok(mockReq.user);
      assert.equal(mockReq.user.id, testUser.id);
    });

    it('requireRole should allow users with matching role and reject others with 403', () => {
      const adminReq = { user: { id: testAdmin.id, roles: ['admin'] } };
      const userReq = { user: { id: testUser.id, roles: ['user'] } };
      let forbiddenStatus = null;
      let forbiddenMessage = null;

      const mockRes = {
        status: (code) => {
          forbiddenStatus = code;
          return {
            json: (data) => {
              forbiddenMessage = data.message;
            },
          };
        },
      };

      const checkAdmin = localSdk.requireRole('admin');

      // Admin user passes
      let adminPassed = false;
      checkAdmin(adminReq, mockRes, () => {
        adminPassed = true;
      });
      assert.equal(adminPassed, true);

      // Regular user gets 403
      let userPassed = false;
      checkAdmin(userReq, mockRes, () => {
        userPassed = true;
      });
      assert.equal(userPassed, false);
      assert.equal(forbiddenStatus, 403);
      assert.match(forbiddenMessage, /Requires 'admin' role/i);
    });

    it('requirePermission should allow users with wildcard or specific permission', () => {
      const adminReq = { user: { id: testAdmin.id, permissions: ['*'] } };
      const customerReq = { user: { id: testUser.id, permissions: ['orders:read'] } };
      let forbiddenStatus = null;

      const mockRes = {
        status: (code) => {
          forbiddenStatus = code;
          return { json: () => {} };
        },
      };

      const checkCreate = localSdk.requirePermission('orders:create');

      // Admin with '*' passes
      let adminPassed = false;
      checkCreate(adminReq, mockRes, () => {
        adminPassed = true;
      });
      assert.equal(adminPassed, true);

      // Customer without 'orders:create' gets 403
      let customerPassed = false;
      checkCreate(customerReq, mockRes, () => {
        customerPassed = true;
      });
      assert.equal(customerPassed, false);
      assert.equal(forbiddenStatus, 403);
    });
  });

  describe('ShopG Integration Example Endpoints', () => {
    let shopgAuthSdk;

    before(() => {
      shopgAuthSdk = new AccessGate({
        jwtSecret: env.jwtAccessSecret,
      });
    });

    it('GET /api/products should be public and accessible without authentication', async () => {
      const res = await request(shopgApp).get('/api/products').expect(200);
      assert.ok(Array.isArray(res.body.products));
      assert.ok(res.body.products.length >= 2);
    });

    it('GET /api/orders should reject unauthenticated requests with 401', async () => {
      const res = await request(shopgApp).get('/api/orders').expect(401);
      assert.equal(res.body.error, 'Unauthorized');
    });
  });
});
