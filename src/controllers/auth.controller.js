import AuthService from '../services/auth.service.js';
import UserModel from '../models/user.model.js';
import env from '../config/env.js';

export const AuthController = {
  /**
   * GET /auth/google
   * Redirects user to Google OAuth consent screen (or local mock fallback)
   */
  async googleAuth(req, res, next) {
    try {
      const returnTo = req.query.return_to || req.query.state || req.headers.referer || '/dashboard';
      const isMock = req.query.mock === 'true' || !env.googleClientId || env.googleClientId === 'mock_google_client_id';

      if (isMock) {
        const callbackUrl = new URL(env.googleCallbackUrl, `${req.protocol}://${req.get('host')}`);
        callbackUrl.searchParams.set('code', 'mock_google_code');
        callbackUrl.searchParams.set('state', returnTo);
        return res.redirect(callbackUrl.toString());
      }

      const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      googleAuthUrl.searchParams.set('client_id', env.googleClientId);
      googleAuthUrl.searchParams.set('redirect_uri', env.googleCallbackUrl);
      googleAuthUrl.searchParams.set('response_type', 'code');
      googleAuthUrl.searchParams.set('scope', 'openid email profile');
      googleAuthUrl.searchParams.set('access_type', 'offline');
      googleAuthUrl.searchParams.set('prompt', 'consent');
      googleAuthUrl.searchParams.set('state', returnTo);

      res.redirect(googleAuthUrl.toString());
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /auth/google/callback
   * Handles Google OAuth2 callback, fetches user profile, creates/links user, issues tokens
   */
  async googleCallback(req, res, next) {
    try {
      const { code, error, state } = req.query;

      if (error) {
        const errorDesc = req.query.error_description || error;
        return res.redirect(`/login?error=${encodeURIComponent(errorDesc)}`);
      }

      if (!code) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Authorization code is required in query params',
        });
      }

      const profile = await AuthService.exchangeGoogleCode(code);
      const result = await AuthService.handleGoogleAuth({
        profile,
        ipAddress: req.ip || req.socket?.remoteAddress || '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
      });

      // Set httpOnly cookie with refreshToken for frontend console silent refresh
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: env.isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // If client requests JSON format directly (programmatic API / test requests)
      if (req.headers.accept?.includes('application/json') && req.query.format === 'json') {
        return res.status(200).json({
          message: 'Google authentication successful',
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          user: result.user,
          data: result,
        });
      }

      // Determine redirect URL
      let redirectUrl = '/dashboard';
      if (state && typeof state === 'string' && (state.startsWith('/') || state.startsWith('http://') || state.startsWith('https://'))) {
        if (state.includes('/login') || state.includes('/signup')) {
          redirectUrl = state.replace(/\/login|\/signup/, '/dashboard');
        } else {
          redirectUrl = state;
        }
      }

      res.redirect(redirectUrl);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/auth/register
   */
  async register(req, res, next) {
    try {
      const { email, password, name } = req.body;
      if (!email || !password) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Email and password are required',
        });
      }

      const result = await AuthService.register({ email, password, name });

      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: env.isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(201).json({
        message: 'User registered successfully',
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        user: result.user,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/auth/login
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Email and password are required',
        });
      }

      const result = await AuthService.login({
        email,
        password,
        ipAddress: req.ip || req.socket?.remoteAddress || '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
      });

      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: env.isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({
        message: 'Login successful',
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        user: result.user,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/auth/me
   */
  async me(req, res, next) {
    try {
      const user = await UserModel.findById(req.user.sub);
      if (!user) {
        return res.status(404).json({
          error: 'NotFound',
          message: 'User not found',
        });
      }

      res.status(200).json({
        data: { user },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/auth/refresh
   */
  async refresh(req, res, next) {
    try {
      const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;
      if (!refreshToken) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'refreshToken is required',
        });
      }

      const result = await AuthService.refresh({ refreshToken });

      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: env.isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({
        message: 'Tokens refreshed successfully',
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        user: result.user,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/auth/logout
   */
  async logout(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        await AuthService.revokeToken(token);
      }

      res.clearCookie('refreshToken', { path: '/' });

      res.status(200).json({
        message: 'Logged out successfully',
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/auth/logout-all
   */
  async logoutAll(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
      await AuthService.logoutAll(req.user.sub, token);

      res.clearCookie('refreshToken', { path: '/' });

      res.status(200).json({
        message: 'Logged out from all devices successfully',
      });
    } catch (err) {
      next(err);
    }
  },
};

export default AuthController;
