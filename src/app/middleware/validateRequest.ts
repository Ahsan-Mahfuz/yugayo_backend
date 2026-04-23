import { Request, Response, NextFunction } from "express";
import { ZodError, ZodTypeAny } from "zod";

export const validateRequest = (schema: ZodTypeAny) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(err); // forwarded to globalErrorHandler
      }
      next(err);
    }
  };
};