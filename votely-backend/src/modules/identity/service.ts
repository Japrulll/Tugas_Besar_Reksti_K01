import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { HttpError } from "../../shared/http.js";
import { prisma } from "../../shared/prisma.js";

export const FACE_MATCH_THRESHOLD = Number(process.env.FACE_MATCH_THRESHOLD || 0.7);
export const VOTE_TOKEN_TTL_SECONDS = Number(process.env.VOTE_TOKEN_TTL_SECONDS || 10 * 60);

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function callPython(path: string, body: unknown): Promise<any> {
  const response = await fetch(`${env.pythonApiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpError(response.status, data.error || `Python API returned ${response.status}`, data);
  return data;
}

async function ensureParticipant(userId: string, electionId: string) {
  const participant = await prisma.electionParticipant.findUnique({
    where: { electionId_userId: { electionId: BigInt(electionId), userId } },
    select: { id: true },
  });
  if (!participant) throw new HttpError(403, "Anda tidak terdaftar sebagai peserta pemilu ini.");
}

async function createVoteToken(userId: string, electionId: string) {
  const voteToken = crypto.randomBytes(32).toString("base64url");
  await prisma.voteToken.create({
    data: {
      userId,
      electionId: BigInt(electionId),
      tokenHash: hashToken(voteToken),
      expiresAt: new Date(Date.now() + VOTE_TOKEN_TTL_SECONDS * 1000),
    },
  });
  return voteToken;
}

export async function generateEmbedding(image: string) {
  if (!image) throw new HttpError(400, "Image data is required");
  return callPython("/generate-embedding", { image });
}

export async function registerFace(nik: string, image: string) {
  if (!nik) throw new HttpError(400, "NIK is required for face registration");
  const penduduk = await prisma.penduduk.findUnique({ where: { nik }, select: { id: true, namaLengkap: true } });
  if (!penduduk) throw new HttpError(404, "User not found. Please register first.");
  const result = await generateEmbedding(image);
  if (!result.success || !result.embedding) throw new HttpError(400, result.error || "No face detected in image. Please try again.");
  await prisma.penduduk.update({
    where: { nik },
    data: {
      foto: {
        embedding_vector: result.embedding,
        face_location: result.face_location,
        registered_at: new Date().toISOString(),
      },
    },
  });
  return { success: true, message: "Face registered successfully", user_name: penduduk.namaLengkap, timestamp: new Date().toISOString() };
}

export async function verifyFace(params: { image: string | string[]; nik?: string; userId?: string; electionId?: string }) {
  let userNik = params.nik;
  if (!userNik && params.userId) {
    const user = await prisma.user.findUnique({ where: { id: params.userId }, include: { penduduk: { select: { nik: true } } } });
    userNik = user?.penduduk?.nik;
  }
  if (!userNik) throw new HttpError(400, "NIK is required for face verification. Please login again.");

  const penduduk = await prisma.penduduk.findUnique({
    where: { nik: userNik },
    select: { foto: true, namaLengkap: true, user: { select: { id: true } } },
  });
  if (!penduduk) throw new HttpError(404, "User not found");

  if (params.electionId && penduduk.user?.id) {
    await ensureParticipant(penduduk.user.id, params.electionId);
  }

  if (env.faceBypassEnabled) {
    const voteToken = params.electionId && penduduk.user?.id
      ? await createVoteToken(penduduk.user.id, params.electionId)
      : undefined;

    return {
      similarity: 1,
      message: "Success (face bypass aktif)",
      face_detected: true,
      face_location: null,
      user_name: penduduk.namaLengkap,
      verified: true,
      bypassed: true,
      voteToken,
      expiresIn: voteToken ? VOTE_TOKEN_TTL_SECONDS : undefined,
      timestamp: new Date().toISOString(),
    };
  }

  const images = Array.isArray(params.image) ? params.image.filter(Boolean) : [params.image].filter(Boolean);
  if (images.length === 0) throw new HttpError(400, "Image data is required");

  const referenceEmbedding = (penduduk.foto as any)?.embedding_vector;
  if (!referenceEmbedding || !Array.isArray(referenceEmbedding)) {
    throw new HttpError(404, "No face embedding found for this user. Please register your face first.");
  }

  const verificationResults = [];
  for (const image of images) {
    const result = await callPython("/verify-face", { image, reference_embedding: referenceEmbedding });
    verificationResults.push(result);
  }

  const similarities = verificationResults.map((result) => Number(result.similarity || 0));
  const verified = verificationResults.every((result, index) => (
    Boolean(result.face_detected) && similarities[index] >= FACE_MATCH_THRESHOLD
  ));
  const bestResult = verificationResults.reduce((best, result) => (
    Number(result.similarity || 0) > Number(best.similarity || 0) ? result : best
  ), verificationResults[0]);
  let voteToken: string | undefined;

  if (verified && params.electionId && penduduk.user?.id) {
    voteToken = await createVoteToken(penduduk.user.id, params.electionId);
  }

  return {
    similarity: similarities.length ? Math.min(...similarities) : 0,
    similarities,
    snapshotCount: images.length,
    message: verified ? "Success" : bestResult.message || "Face verification failed",
    face_detected: verificationResults.every((result) => Boolean(result.face_detected)),
    face_location: bestResult.face_location,
    user_name: penduduk.namaLengkap,
    verified,
    voteToken,
    expiresIn: voteToken ? VOTE_TOKEN_TTL_SECONDS : undefined,
    timestamp: new Date().toISOString(),
  };
}

export function hashVoteToken(token: string) {
  return hashToken(token);
}
