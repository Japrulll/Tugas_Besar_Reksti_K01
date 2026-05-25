import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { prisma, Role, type Penduduk, type User } from "../../shared/prisma.js";
import { HttpError } from "../../shared/http.js";
import { generateWallet } from "../wallet/service.js";
import { verifyFace } from "../identity/service.js";

type PendudukInput = Omit<Penduduk, "id" | "createdAt" | "updatedAt" | "foto" | "alamat">;

export function signAuthToken(user: Pick<User, "id" | "role">, nik?: string) {
  return jwt.sign({ userId: user.id, role: user.role, nik }, env.jwtSecret, { expiresIn: "1d" });
}

export function verifyAuthToken(token: string) {
  try {
    return jwt.verify(token, env.jwtSecret) as { userId: string; role: Role; nik?: string };
  } catch {
    throw new HttpError(401, "Token tidak valid atau kadaluarsa.");
  }
}

export async function getUserByNik(nik: string) {
  const penduduk = await prisma.penduduk.findUnique({ where: { nik }, include: { user: true } });
  return penduduk?.user || null;
}

export async function loginVoterAccount(nik: string, password: string) {
  const user = await getUserByNik(nik);
  if (!user) throw new HttpError(401, "Kombinasi NIK atau password salah.");
  if (user.role !== Role.ADMIN) {
    throw new HttpError(403, "Login password hanya tersedia untuk admin web.");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) throw new HttpError(401, "Kombinasi NIK atau password salah.");

  const token = signAuthToken(user, nik);
  return {
    token,
    user: {
      id: user.id,
      role: user.role,
      walletAddress: user.walletAddress,
    },
  };
}

export async function faceLoginVoterAccount(nik: string, image?: string | string[]) {
  if (!nik) throw new HttpError(400, "NIK wajib diisi.");

  const penduduk = await prisma.penduduk.findUnique({
    where: { nik },
    include: { user: true },
  });
  const user = penduduk?.user;
  if (!penduduk || !user || user.role !== Role.WARGA) {
    throw new HttpError(401, "NIK belum terdaftar sebagai peserta pemilu.");
  }

  const participantCount = await prisma.electionParticipant.count({
    where: { userId: user.id, election: { deletedAt: null } },
  });
  if (participantCount === 0) {
    throw new HttpError(403, "NIK belum didaftarkan sebagai peserta election mana pun.");
  }

  if (!env.faceBypassEnabled) {
    if (!image || (Array.isArray(image) && image.length === 0)) throw new HttpError(400, "Foto wajah wajib dikirim.");
    const result = await verifyFace({ nik, image });
    if (!result.verified) throw new HttpError(401, result.message || "Verifikasi wajah gagal.");
  }

  const token = signAuthToken(user, nik);
  return {
    token,
    bypassed: env.faceBypassEnabled,
    user: {
      id: user.id,
      role: user.role,
      walletAddress: user.walletAddress,
    },
  };
}

export async function getCurrentUserFromToken(token: string) {
  const decoded = verifyAuthToken(token);
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      role: true,
      walletAddress: true,
      createdAt: true,
      penduduk: {
        select: {
          id: true,
          nik: true,
          namaLengkap: true,
          provinsi: true,
          kabKota: true,
          kecamatan: true,
          kelurahan: true,
        },
      },
    },
  });

  if (!user) throw new HttpError(401, "User tidak ditemukan.");
  return user;
}

export async function registerVoterAccount(password: string, pendudukData: PendudukInput) {
  const existingUser = await getUserByNik(pendudukData.nik);
  if (existingUser) throw new HttpError(409, "NIK sudah terdaftar sebagai akun.");

  const citizenData = await prisma.penduduk.findUnique({ where: { nik: pendudukData.nik } });
  if (!citizenData) throw new HttpError(404, "NIK tidak ditemukan dalam database kependudukan (Penduduk).");

  const mismatchedFields: string[] = [];
  if (citizenData.namaLengkap !== pendudukData.namaLengkap) mismatchedFields.push("nama lengkap");
  if (citizenData.provinsi !== pendudukData.provinsi) mismatchedFields.push("provinsi");
  if (citizenData.kabKota !== pendudukData.kabKota) mismatchedFields.push("kota");
  if (citizenData.kecamatan !== pendudukData.kecamatan) mismatchedFields.push("kecamatan");
  if (citizenData.kelurahan !== pendudukData.kelurahan) mismatchedFields.push("kelurahan");
  if (citizenData.tanggalLahir.getTime() !== pendudukData.tanggalLahir.getTime()) mismatchedFields.push("tanggal lahir");
  if (mismatchedFields.length) throw new HttpError(400, `Data tidak sesuai: ${mismatchedFields.join(", ")}`);

  const hashedPassword = await bcrypt.hash(password, 10);
  const wallet = generateWallet();
  const user = await prisma.user.create({
    data: {
      password: hashedPassword,
      role: Role.WARGA,
      pendudukId: citizenData.id,
      walletAddress: wallet.walletAddress,
      encryptedPrivateKey: wallet.encryptedPrivateKey,
    },
  });

  const { password: _password, encryptedPrivateKey: _privateKey, ...safeUser } = user;
  return safeUser;
}

export async function registerWithFace(body: any) {
  const { nik, namaLengkap, password, provinsi, kabKota, kecamatan, kelurahan, dob, faceEmbedding } = body;
  if (!nik || !namaLengkap || !password || !provinsi || !kabKota || !dob) {
    throw new HttpError(400, "Semua field wajib diisi.");
  }
  if (!faceEmbedding || !Array.isArray(faceEmbedding)) {
    throw new HttpError(400, "Face embedding wajib diisi.");
  }

  const existingPenduduk = await prisma.penduduk.findUnique({ where: { nik }, include: { user: true } });
  if (existingPenduduk?.user) throw new HttpError(409, "NIK sudah terdaftar sebagai akun.");

  const hashedPassword = await bcrypt.hash(password, 10);
  const wallet = generateWallet();

  const result = await prisma.$transaction(async (tx) => {
    const penduduk = existingPenduduk
      ? await tx.penduduk.update({
          where: { nik },
          data: {
            namaLengkap,
            tanggalLahir: new Date(dob),
            provinsi,
            kabKota,
            kecamatan,
            kelurahan,
            foto: { embedding_vector: faceEmbedding, registered_at: new Date().toISOString() },
          },
        })
      : await tx.penduduk.create({
          data: {
            nik,
            namaLengkap,
            tanggalLahir: new Date(dob),
            provinsi,
            kabKota,
            kecamatan,
            kelurahan,
            foto: { embedding_vector: faceEmbedding, registered_at: new Date().toISOString() },
          },
        });

    const user = await tx.user.create({
      data: {
        pendudukId: penduduk.id,
        password: hashedPassword,
        role: Role.WARGA,
        walletAddress: wallet.walletAddress,
        encryptedPrivateKey: wallet.encryptedPrivateKey,
      },
    });

    return { penduduk, user };
  });

  return {
    id: result.user.id,
    nik: result.penduduk.nik,
    namaLengkap: result.penduduk.namaLengkap,
    walletAddress: result.user.walletAddress,
  };
}
