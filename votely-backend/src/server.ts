import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { openApiDocument } from "./docs/openapi.js";
import { errorHandler, notFoundHandler } from "./shared/http.js";
import { adminRouter } from "./modules/admin/routes.js";
import { authRouter } from "./modules/auth/routes.js";
import { electionsRouter } from "./modules/elections/routes.js";
import { identityRouter } from "./modules/identity/routes.js";
import { iotCameraRouter } from "./modules/iotCamera/routes.js";
import { storageRouter } from "./modules/storage/routes.js";
import { votingRouter } from "./modules/voting/routes.js";

export function createApp() {
  const app = express();
  const origins = env.corsOrigin.split(",").map((origin) => origin.trim()).filter(Boolean);

  app.use(cors({ origin: origins, credentials: true }));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.get("/openapi.json", (_req, res) => {
    res.json(openApiDocument);
  });

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument, {
    customSiteTitle: "Votely API Docs",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: "none",
    },
  }));

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "votely-backend",
      faceBypassEnabled: env.faceBypassEnabled,
      pythonApiUrl: env.pythonApiUrl,
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/face-verify", identityRouter);
  app.use("/api/iot-camera", iotCameraRouter);
  app.use("/api/elections", electionsRouter);
  app.use("/api/vote", votingRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/upload", storageRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
