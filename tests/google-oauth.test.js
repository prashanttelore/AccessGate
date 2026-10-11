import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../src/app.js';
import UserModel from '../src/models/user.model.js';
import AuthService from '../src/services/auth.service.js';

describe('Google OAuth2 Authentication Flow', () => {
  beforeEach(async () => {
    await UserModel.clearAll();
  });

  describe('GET /auth/google — Initiation', () => {
    it('should redirect (302) when initiated', async () => {
      const res = await request(app)
        .get('/auth/google')
        .expect(302);

      assert.ok(res.headers.location);
      assert.ok(
        res.headers.location.includes('google') ||
        res.headers.location.includes('callback') ||
        res.headers.location.includes('accounts.google.com')
      );
    });

    it('should redirect to callback with mock code when mock=true', async () => {
      const res = await request(app)
        .get('/auth/google?mock=true&state=/dashboard')
        .expect(302);

      assert.ok(res.headers.location.includes('code=mock_google_code'));
      assert.ok(res.headers.location.includes('state=%2Fdashboard') || res.headers.location.includes('state=/dashboard'));
    });
  });

  describe('GET /auth/google/callback — Code Exchange & Account Resolution', () => {
    it('should return 400 when authorization code is missing', async () => {
      const res = await request(app)
        .get('/auth/google/callback')
        .expect(400);

      assert.strictEqual(res.body.error, 'BadRequest');
      assert.ok(res.body.message.includes('code is required'));
    });

    it('should create new OAuth user, set refreshToken cookie, and redirect to dashboard', async () => {
      const res = await request(app)
        .get('/auth/google/callback?code=mock_google_code&state=/dashboard')
        .expect(302);

      assert.strictEqual(res.headers.location, '/dashboard');

      // Check cookie header
      const cookies = res.headers['set-cookie'];
      assert.ok(cookies && cookies.length > 0, 'Set-Cookie header should be present');
      assert.ok(cookies[0].includes('refreshToken='), 'refreshToken cookie should be set');
      assert.ok(cookies[0].includes('HttpOnly'), 'Cookie must be HttpOnly');

      // Verify user was created in database
      const createdUser = await UserModel.findByEmail('google.mock@example.com');
      assert.ok(createdUser);
      assert.strictEqual(createdUser.google_id, 'google-mock-id-12345');
      assert.strictEqual(createdUser.password_hash, null);
    });

    it('should return 200 JSON with AccessGate tokens when format=json is requested', async () => {
      const res = await request(app)
        .get('/auth/google/callback?code=mock_google_code&format=json')
        .set('Accept', 'application/json')
        .expect(200);

      assert.ok(res.body.accessToken);
      assert.ok(res.body.refreshToken);
      assert.strictEqual(res.body.user.email, 'google.mock@example.com');
      assert.strictEqual(res.body.message, 'Google authentication successful');
    });

    it('should link google_id to existing account if email already exists', async () => {
      // Create user first with email/password
      const passwordHash = await AuthService.hashPassword('ExistingPassword123!');
      const existing = await UserModel.create({
        email: 'google.mock@example.com',
        passwordHash,
        name: 'Existing User',
        role: 'user',
      });
      assert.strictEqual(existing.google_id, null);

      // Now authenticate via Google with matching email
      const res = await request(app)
        .get('/auth/google/callback?code=mock_google_code&format=json')
        .set('Accept', 'application/json')
        .expect(200);

      assert.strictEqual(res.body.user.email, 'google.mock@example.com');
      assert.strictEqual(res.body.user.id, existing.id);

      // Verify account was updated with google_id while preserving password
      const updated = await UserModel.findByEmail('google.mock@example.com');
      assert.strictEqual(updated.google_id, 'google-mock-id-12345');
      assert.strictEqual(updated.password_hash, passwordHash);
    });
  });

  describe('OAuth-Only Login Guard & Cookie Refresh', () => {
    it('should fail gracefully (400) when OAuth-only user tries to login with password', async () => {
      // Create OAuth-only user
      await UserModel.create({
        email: 'oauth.only@example.com',
        name: 'OAuth Only',
        googleId: 'google-oauth-999',
        passwordHash: null,
      });

      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'oauth.only@example.com',
          password: 'AnyPassword123!',
        })
        .expect(400);

      assert.ok(res.body.message.includes('Google Sign-In') || res.body.message.includes('sign in with Google'));
    });

    it('should allow token refresh using HTTP-only cookie', async () => {
      // Create user and generate tokens
      const user = await UserModel.create({
        email: 'cookie.user@example.com',
        name: 'Cookie User',
        googleId: 'google-cookie-111',
        passwordHash: null,
      });
      const tokens = AuthService.generateTokens(user);

      // Call /auth/refresh with cookie and no body
      const res = await request(app)
        .post('/auth/refresh')
        .set('Cookie', [`refreshToken=${tokens.refreshToken}`])
        .send({})
        .expect(200);

      assert.ok(res.body.accessToken);
      assert.ok(res.body.refreshToken);
      assert.strictEqual(res.body.user.email, 'cookie.user@example.com');

      // Ensure new rotated cookie is set
      const cookies = res.headers['set-cookie'];
      assert.ok(cookies && cookies[0].includes('refreshToken='));
    });
  });
});
