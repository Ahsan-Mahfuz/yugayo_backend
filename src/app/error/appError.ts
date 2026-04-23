class AppError extends Error {
  public statusCode: number;
  public status: string;
  public errorCode?: string;

  constructor(
    statusCode: number,
    message: string,
    errorCode?: string,
    stack = "",
  ) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error"; 

    if (errorCode) {
      this.errorCode = errorCode; 
    }

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default AppError;
