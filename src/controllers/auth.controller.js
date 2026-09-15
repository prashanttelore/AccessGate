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

      const result = await AuthService.login({ email, password });
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
};

export default AuthController;
