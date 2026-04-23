/* eslint-disable @typescript-eslint/no-explicit-any */
import express, { Request, Response } from "express";
import cors from "cors";
import notFound from "./app/middleware/notFoundRoute";
import router from "./app/routes";
import errorMiddleware from "./app/middleware/globalErrorHandler";
const app = express();

app.use(express.json());
const corsOptions = {
  origin: (origin: any, callback: any) => {
    callback(null, true);
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

app.use("/uploads", express.static("uploads"));
app.use("/api/v1", router);

const test = async (req: Request, res: Response) => {
  res.send("Yugayo server is running Successfully.");
};

app.get("/", test);

// not found route
app.use(errorMiddleware);
app.use(notFound);
export default app;
