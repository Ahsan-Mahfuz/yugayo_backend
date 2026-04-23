/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import AppError from "../error/appError";

const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let statusCode = 500;
  let message = err.message || "Internal Server Error";
  let errorMessages = [{ path: "", message }];
  let status = "error";
  let errorCode = null;

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation Error";
    errorMessages = Object.values(err.errors).map((el: any) => ({
      path: el.path,
      message: el.message,
    }));
  } else if (err.name === "CastError") {
    statusCode = 400;
    message = "Cast Error";
    errorMessages = [{ path: err.path, message: "Invalid ID format" }];
  } else if (err.code === 11000) {
    statusCode = 400;
    message = "Duplicate Entry";
    errorMessages = [{ path: "", message: err.message }];
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = "Validation Error";
    errorMessages = err.errors.map((error: any) => ({
      path: error.path.join("."),
      message: error.message,
    }));
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    status = err.status;
    errorCode = err.errorCode || null;
  }

  res.status(statusCode).json({
    success: false,
    message,
    status,
    statusCode,
    errorCode,
    errorMessages,
    stack: err.stack,
  });
};

export default errorMiddleware;
