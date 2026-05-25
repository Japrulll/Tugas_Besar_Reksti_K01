import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateWallet } from "@/lib/wallet";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const nik = String(body.nik || "").trim();
    const namaLengkap = String(body.namaLengkap || "").trim();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirmPassword || "");
    const tanggalLahir = body.tanggalLahir ? new Date(body.tanggalLahir) : new Date("2000-01-01");

    if (!nik || !namaLengkap || !password) {
      return NextResponse.json({ error: "NIK, nama lengkap, dan password wajib diisi." }, { status: 400 });
    }

    if (!/^\d{16}$/.test(nik)) {
      return NextResponse.json({ error: "NIK harus terdiri dari 16 digit angka." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password minimal 8 karakter." }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Konfirmasi password tidak sama." }, { status: 400 });
    }

    if (Number.isNaN(tanggalLahir.getTime())) {
      return NextResponse.json({ error: "Tanggal lahir tidak valid." }, { status: 400 });
    }

    const existingPenduduk = await prisma.penduduk.findUnique({
      where: { nik },
      include: { user: true },
    });

    if (existingPenduduk?.user) {
      return NextResponse.json({ error: "NIK sudah terdaftar sebagai akun." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const wallet = generateWallet();

    const user = await prisma.$transaction(async (tx) => {
      const penduduk = existingPenduduk
        ? await tx.penduduk.update({
            where: { nik },
            data: { namaLengkap, tanggalLahir },
          })
        : await tx.penduduk.create({
            data: {
              nik,
              namaLengkap,
              tanggalLahir,
            },
          });

      return tx.user.create({
        data: {
          password: passwordHash,
          role: "ADMIN",
          pendudukId: penduduk.id,
          walletAddress: wallet.walletAddress,
          encryptedPrivateKey: wallet.encryptedPrivateKey,
        },
        select: {
          id: true,
          role: true,
          walletAddress: true,
          penduduk: {
            select: {
              nik: true,
              namaLengkap: true,
            },
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Admin berhasil didaftarkan.",
      data: user,
    });
  } catch (error) {
    console.error("Register admin error:", error);
    return NextResponse.json({ error: "Gagal mendaftarkan admin." }, { status: 500 });
  }
}
