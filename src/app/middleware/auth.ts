import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import AppError from "../error/appError";
import { User } from "../modules/user/user.model";
import { TRole } from "../modules/user/user.interface";
import { ITokenPayload } from "../modules/auth/auth.interface";
import config from "../config";

/**
 * auth(...roles)
 *
 * Pass zero roles → any authenticated user is allowed.
 * Pass one or more roles → only those roles are allowed.
 *
 * Examples:
 *   auth()                          – any logged-in user
 *   auth("patient")                 – patients only
 *   auth("clinician")               – clinicians only
 *   auth("admin")                   – admins only
 *   auth("patient", "clinician")    – patients and clinicians
 */
export const auth = (...roles: TRole[]) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // 1. Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return next(new AppError(401, "Unauthorized – no token provided"));
      }

      const token = authHeader.split(" ")[1];

      // 2. Verify token
      let decoded: ITokenPayload;
      try {
        decoded = jwt.verify(
          token,
          config.jwt_access_secret as string
        ) as ITokenPayload;
      } catch {
        return next(
          new AppError(401, "Unauthorized – invalid or expired token")
        );
      }

      // 3. Check user still exists and is active
      const user = await User.findById(decoded.userId).select("isActive role");
      if (!user)
        return next(new AppError(401, "Unauthorized – user no longer exists"));
      if (!user.isActive)
        return next(new AppError(403, "Your account has been deactivated"));

      // 4. Role check
      if (roles.length > 0 && !roles.includes(decoded.role)) {
        return next(
          new AppError(
            403,
            `Forbidden – this route is restricted to: ${roles.join(", ")}`
          )
        );
      }

      // 5. Attach user info to request
      req.user = decoded;
      next();
    } catch (err) {
      next(err);
    }
  };
};

// ─── Convenience aliases ──────────────────────────────────────────────────────

/** Only patients */
export const patientAuth = auth("patient");

/** Only clinicians */
export const clinicianAuth = auth("clinician");

/** Only admins */
export const adminAuth = auth("admin");

/** Patients and clinicians (no admins) */
export const userAuth = auth("patient", "clinician");
