import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware';

/**
 * Middleware to validate that the user has contributor role
 */
export const validateContributorRole = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (req.user.role !== 'contributor') {
      res.status(403).json({
        success: false,
        message: 'Access denied. Contributor role required.',
        userRole: req.user.role,
      });
      return;
    }

    console.log(`Contributor access granted for user: ${req.user.email}`);
    next();
  } catch (error: any) {
    console.error('Role validation error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Role validation failed',
    });
  }
};

/**
 * Middleware to validate that the user has maintainer role
 */
export const validateMaintainerRole = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (req.user.role !== 'maintainer') {
      res.status(403).json({
        success: false,
        message: 'Access denied. Maintainer role required.',
        userRole: req.user.role,
      });
      return;
    }

    console.log(`Maintainer access granted for user: ${req.user.email}`);
    next();
  } catch (error: any) {
    console.error('Role validation error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Role validation failed',
    });
  }
};

/**
 * Middleware to validate that the user has company role
 */
export const validateCompanyRole = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (req.user.role !== 'company') {
      res.status(403).json({
        success: false,
        message: 'Access denied. Company role required.',
        userRole: req.user.role,
      });
      return;
    }

    console.log(`Company access granted for user: ${req.user.email}`);
    next();
  } catch (error: any) {
    console.error('Role validation error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Role validation failed',
    });
  }
};

/**
 * Middleware to validate multiple roles (OR condition)
 */
export const validateMultipleRoles = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      if (!allowedRoles.includes(req.user.role)) {
        res.status(403).json({
          success: false,
          message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
          userRole: req.user.role,
        });
        return;
      }

      console.log(`Multi-role access granted for user: ${req.user.email} with role: ${req.user.role}`);
      next();
    } catch (error: any) {
      console.error('Multi-role validation error:', error.message);
      res.status(500).json({
        success: false,
        message: 'Role validation failed',
      });
    }
  };
};