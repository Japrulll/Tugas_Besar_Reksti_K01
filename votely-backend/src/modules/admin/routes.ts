import { Router } from "express";
import multer from "multer";
import { prisma } from "../../shared/prisma.js";
import { asyncHandler, HttpError } from "../../shared/http.js";
import { electionStatus, serializeBigInt } from "../../shared/serializers.js";
import { requireAdmin, type AuthenticatedRequest } from "../auth/middleware.js";
import { createChainElection, addChainCandidate } from "../blockchain/service.js";
import { getAllElections, getElectionById, getVoteCounts } from "../elections/service.js";
import { importElectionParticipants, importElectionParticipantsCsv, parseVoterCsv } from "./voterCsv.js";

export const adminRouter = Router();
const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const headers = lines.shift()?.split(",").map((h) => h.trim()) || [];
  return lines.map((line) => {
    const values = line.split(",").map((value) => value.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function ensureOwnElection<T extends { createdBy: string }>(election: T | null, userId: string): asserts election is T {
  if (!election || election.createdBy !== userId) throw new HttpError(404, "Election not found");
}

adminRouter.get("/elections", requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const elections = await getAllElections(false, req.user!.id);
  res.json({ success: true, data: serializeBigInt(elections) });
}));

adminRouter.post("/elections", requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { name, description, level, city, province, startTime, endTime, candidates } = req.body;
  if (!name || !description || !level || !startTime || !endTime) throw new HttpError(400, "Missing required fields");
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (end <= start) throw new HttpError(400, "End time must be after start time");
  const election = await prisma.election.create({
    data: {
      name,
      description,
      level,
      city: city || null,
      province: province || null,
      startTime: start,
      endTime: end,
      createdBy: req.user!.id,
      candidates: Array.isArray(candidates) ? {
        create: candidates.map((candidate: any, index: number) => ({
          name: candidate.name,
          party: candidate.party,
          description: candidate.description || null,
          photoUrl: candidate.photoUrl || null,
          orderIndex: index,
        })),
      } : undefined,
    },
    include: { candidates: true },
  });
  res.status(201).json({ success: true, data: serializeBigInt(election), message: "Election created successfully" });
}));

adminRouter.post("/elections/create-and-deploy", requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const name = req.body.name || req.body.title;
  const start = new Date(req.body.startTime || req.body.startDate);
  const end = new Date(req.body.endTime || req.body.endDate);
  const candidates = Array.isArray(req.body.candidates) ? req.body.candidates : [];
  const voterImport = typeof req.body.voterCsv === "string" && req.body.voterCsv.trim()
    ? parseVoterCsv(req.body.voterCsv)
    : null;
  if (!name || !req.body.description || !req.body.level || !start || !end) throw new HttpError(400, "Missing required fields");
  if (voterImport && voterImport.valid.length === 0) throw new HttpError(400, "Spreadsheet pemilih tidak memiliki data valid.", { voterImport });

  const deployed = await createChainElection({ name, description: req.body.description, startTime: start, endTime: end });
  const candidateChainIds = new Map<number, bigint>();
  for (let i = 0; i < candidates.length; i += 1) {
    const result = await addChainCandidate({
      chainElectionId: deployed.chainElectionId,
      name: candidates[i].name,
      party: candidates[i].party,
      photoUrl: candidates[i].photoUrl,
      expectedChainCandidateId: BigInt(i + 1),
    });
    candidateChainIds.set(i, result.chainCandidateId);
  }

  const result = await prisma.$transaction(async (tx) => {
    const election = await tx.election.create({
      data: {
        name,
        description: req.body.description,
        level: req.body.level,
        city: req.body.city || null,
        province: req.body.province || null,
        startTime: start,
        endTime: end,
        createdBy: req.user!.id,
        chainElectionId: deployed.chainElectionId,
        candidates: {
          create: candidates.map((candidate: any, index: number) => ({
            name: candidate.name,
            party: candidate.party,
            description: candidate.description || null,
            photoUrl: candidate.photoUrl || null,
            orderIndex: index,
            chainCandidateId: candidateChainIds.get(index) || null,
          })),
        },
      },
      include: { candidates: true },
    });
    const voterImportSummary = voterImport ? await importElectionParticipants(tx, election.id, voterImport) : null;
    return { election, voterImportSummary };
  });

  res.json({
    success: true,
    data: serializeBigInt(result.election),
    message: "Election created and deployed successfully!",
    blockchain: serializeBigInt({ transactionHash: deployed.transactionHash, chainElectionId: deployed.chainElectionId, candidatesDeployed: candidates.length }),
    voterImport: result.voterImportSummary,
  });
}));

adminRouter.get("/elections/:electionId", requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const election = await getElectionById(req.params.electionId);
  ensureOwnElection(election, req.user!.id);
  const includeResults = req.query.includeResults === "true";
  const counts = includeResults ? await getVoteCounts(req.params.electionId) : { voteCounts: {}, totalVotes: 0 };
  res.json({
    success: true,
    data: serializeBigInt({
      ...election,
      totalVotes: counts.totalVotes,
      candidates: election.candidates.map((candidate) => ({
        ...candidate,
        voteCount: counts.voteCounts[candidate.id.toString()] || 0,
      })),
    }),
  });
}));

adminRouter.put("/elections/:electionId", requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const election = await getElectionById(req.params.electionId);
  ensureOwnElection(election, req.user!.id);
  if (election.deletedAt) throw new HttpError(400, "Cannot edit a deleted election");
  if (election.chainElectionId) throw new HttpError(400, "Cannot edit election after it has been deployed to blockchain.");
  const {
    id: _id,
    createdBy: _createdBy,
    creator: _creator,
    candidates: _candidates,
    votes: _votes,
    participants: _participants,
    _count,
    chainElectionId: _chainElectionId,
    deletedAt: _deletedAt,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...data
  } = req.body;
  if (data.startTime) data.startTime = new Date(data.startTime);
  if (data.endTime) data.endTime = new Date(data.endTime);
  const updated = await prisma.election.update({ where: { id: BigInt(req.params.electionId) }, data, include: { candidates: true } });
  res.json({ success: true, data: serializeBigInt(updated), message: "Election updated successfully" });
}));

adminRouter.delete("/elections/:electionId", requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const election = await getElectionById(req.params.electionId);
  ensureOwnElection(election, req.user!.id);
  await prisma.election.update({ where: { id: BigInt(req.params.electionId) }, data: { deletedAt: new Date() } });
  res.json({ success: true, message: "Election deleted successfully (soft delete)" });
}));

adminRouter.get("/elections/:electionId/candidates", requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const election = await getElectionById(req.params.electionId);
  ensureOwnElection(election, req.user!.id);
  const candidates = await prisma.candidate.findMany({ where: { electionId: BigInt(req.params.electionId) }, orderBy: { orderIndex: "asc" } });
  res.json({ success: true, data: serializeBigInt(candidates) });
}));

adminRouter.post("/elections/:electionId/candidates", requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const election = await getElectionById(req.params.electionId);
  ensureOwnElection(election, req.user!.id);
  if (electionStatus(election.startTime, election.endTime) !== "upcoming") throw new HttpError(400, "Can only add candidates before election starts");
  const count = await prisma.candidate.count({ where: { electionId: BigInt(req.params.electionId) } });
  const candidate = await prisma.candidate.create({
    data: {
      electionId: BigInt(req.params.electionId),
      name: req.body.name,
      party: req.body.party,
      description: req.body.description || null,
      photoUrl: req.body.photoUrl || null,
      orderIndex: count,
    },
  });
  res.status(201).json({ success: true, data: serializeBigInt(candidate), message: "Candidate added successfully" });
}));

adminRouter.delete("/elections/:electionId/candidates", requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const candidateId = String(req.query.candidateId || "");
  if (!candidateId) throw new HttpError(400, "Candidate ID is required");
  const election = await getElectionById(req.params.electionId);
  ensureOwnElection(election, req.user!.id);
  const candidate = await prisma.candidate.findUnique({ where: { id: BigInt(candidateId) } });
  if (!candidate || candidate.electionId !== election!.id) throw new HttpError(404, "Candidate not found");
  await prisma.candidate.delete({ where: { id: BigInt(candidateId) } });
  res.json({ success: true, message: "Candidate deleted successfully" });
}));

adminRouter.get("/elections/:electionId/stats", requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const election = await getElectionById(req.params.electionId);
  ensureOwnElection(election, req.user!.id);
  const { voteCounts, totalVotes } = await getVoteCounts(req.params.electionId);
  const candidateStats = election.candidates.map((candidate) => {
    const voteCount = voteCounts[candidate.id.toString()] || 0;
    return {
      id: candidate.id.toString(),
      name: candidate.name,
      party: candidate.party,
      voteCount,
      percentage: totalVotes > 0 ? ((voteCount / totalVotes) * 100).toFixed(2) : "0.00",
    };
  });
  res.json({
    success: true,
    data: serializeBigInt({
      electionId: election.id,
      electionName: election.name,
      status: electionStatus(election.startTime, election.endTime),
      totalVotes,
      uniqueVoters: totalVotes,
      candidateCount: election.candidates.length,
      candidateStats,
      startTime: election.startTime,
      endTime: election.endTime,
    }),
  });
}));

adminRouter.get("/reports/elections/:electionId", requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const election = await getElectionById(req.params.electionId);
  ensureOwnElection(election, req.user!.id);
  const votes = await prisma.vote.findMany({
    where: { electionId: BigInt(req.params.electionId) },
    select: { id: true, txHash: true, proofHash: true, castAt: true, userId: true },
    orderBy: { castAt: "asc" },
  });
  const auditLogs = await prisma.auditLog.findMany({
    where: { entityType: "Election", entityId: req.params.electionId },
    orderBy: { createdAt: "asc" },
  });
  res.json({ success: true, data: serializeBigInt({ election, votes, auditLogs }) });
}));

adminRouter.post("/voters/import", requireAdmin, csvUpload.single("file"), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const csv = req.file?.buffer.toString("utf8") || (typeof req.body === "string" ? req.body : req.body.csv);
  const electionId = String(req.body?.electionId || "");
  if (!electionId) throw new HttpError(400, "Election ID wajib diisi.");
  if (!csv) throw new HttpError(400, "CSV content is required in the `csv` field.");

  const election = await prisma.election.findUnique({ where: { id: BigInt(electionId) }, select: { id: true, deletedAt: true, createdBy: true } });
  if (!election || election.deletedAt || election.createdBy !== req.user!.id) throw new HttpError(404, "Election tidak ditemukan.");

  const data = await importElectionParticipantsCsv(electionId, csv, req.user!.id);
  if (data.imported === 0) {
    res.status(400).json({ success: false, error: "Tidak ada peserta valid untuk diimport.", data });
    return;
  }
  res.json({ success: true, data, message: "Import peserta berhasil." });
}));
