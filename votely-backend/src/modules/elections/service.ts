import { prisma } from "../../shared/prisma.js";

export function getElectionById(id: string) {
  return prisma.election.findUnique({
    where: { id: BigInt(id) },
    include: {
      candidates: { orderBy: { orderIndex: "asc" } },
      creator: { include: { penduduk: true } },
    },
  });
}

export async function ensureElectionParticipant(userId: string, electionId: string) {
  const participant = await prisma.electionParticipant.findUnique({
    where: { electionId_userId: { userId, electionId: BigInt(electionId) } },
    select: { id: true },
  });
  return Boolean(participant);
}

export async function getElectionByIdForUser(id: string, userId: string) {
  const participant = await ensureElectionParticipant(userId, id);
  if (!participant) return null;
  return getElectionById(id);
}

export function getAllElections(includeDeleted = false, createdBy?: string) {
  return prisma.election.findMany({
    where: {
      ...(includeDeleted ? {} : { deletedAt: null }),
      ...(createdBy ? { createdBy } : {}),
    },
    include: {
      candidates: { orderBy: { orderIndex: "asc" } },
      creator: { include: { penduduk: true } },
      _count: { select: { votes: true } },
    },
    orderBy: { startTime: "desc" },
  });
}

export async function getElectionsForUser(userId: string) {
  return prisma.election.findMany({
    where: {
      deletedAt: null,
      participants: { some: { userId } },
    },
    include: { candidates: { orderBy: { orderIndex: "asc" } } },
    orderBy: { startTime: "desc" },
  });
}

export async function getVoteCounts(electionId: string) {
  const votes = await prisma.vote.groupBy({
    by: ["candidateId"],
    where: { electionId: BigInt(electionId) },
    _count: { candidateId: true },
  });
  const voteCounts: Record<string, number> = {};
  let totalVotes = 0;
  votes.forEach((vote) => {
    voteCounts[vote.candidateId.toString()] = vote._count.candidateId;
    totalVotes += vote._count.candidateId;
  });
  return { voteCounts, totalVotes };
}
