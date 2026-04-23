/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import config from "./app/config";
import app from "./app";
import { createServer } from "http";
import { initSocket } from "./app/socket/socket";

let httpServer: any;
async function main() {
  await mongoose.connect(config.database_url as string);

  httpServer = createServer(app);
  initSocket(httpServer);

  httpServer.listen(config.port, () => {
    console.log(`Yugayo listening on port ${config.port}`);
  });
}

main();

process.on("unhandledRejection", () => {
  console.log(`unhandledRejection detected, shutting down server`);

  if (httpServer) {
    httpServer.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

process.on("uncaughtException", () => {
  console.log(`uncaughtException on is detected, shutting down server`);
  process.exit(1);
});
