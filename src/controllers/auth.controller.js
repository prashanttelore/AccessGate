import AuthService from '../services/auth.service.js';
import UserModel from '../models/user.model.js';

export const AuthController = {
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
      res.status(201).json({
        message: 'User registered successfully',
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
      res.status(200).json({
        message: 'Login successful',
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
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'refreshToken is required',
        });
      }

      const result = await AuthService.refresh({ refreshToken });
      res.status(200).json({
        message: 'Tokens refreshed successfully',
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

      res.status(200).json({
        message: 'Logged out from all devices successfully',
      });
    } catch (err) {
      next(err);
    }
  },
};

export default AuthController;
