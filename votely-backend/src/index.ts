import { createApp } from "./server.js";
import { env } from "./config/env.js";

const app = createApp();

app.listen(env.port, () => {
  console.log(`[votely-backend] listening on http://localhost:${env.port}`);
  console.log(`[votely-backend] face bypass enabled: ${env.faceBypassEnabled}`);
  console.log(`[votely-backend] python api url: ${env.pythonApiUrl}`);
});
