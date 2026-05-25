import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function parseBoolean(value: string | undefined) {
  return (value || "").trim().replace(/^['"]|['"]$/g, "").toLowerCase() === "true";
}

export const env = {
  port: Number(process.env.PORT || process.env.BACKEND_PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000,http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET || "fallback-secret",
  encryptionKey: process.env.ENCRYPTION_KEY || "",
  pythonApiUrl: process.env.PYTHON_API_URL || process.env.FACE_RECOGNITION_API_URL || "http://127.0.0.1:5000",
  faceBypassEnabled: parseBoolean(process.env.FACE_BYPASS_ENABLED),
  thirdwebClientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "",
  contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "",
  adminPrivateKey: process.env.PRIVATE_KEY || "",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
};
