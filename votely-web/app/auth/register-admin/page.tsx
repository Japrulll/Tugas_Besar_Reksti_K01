"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterAdminPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nik: "",
    namaLengkap: "",
    tanggalLahir: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/auth/register-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Registrasi admin gagal.");
      }

      setSuccess("Admin berhasil dibuat. Mengalihkan ke login...");
      setTimeout(() => router.push("/auth/login"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registrasi admin gagal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <Link href="/auth/login" className="inline-flex h-9 items-center gap-2 rounded-lg px-1 text-sm font-medium text-[#9AA3B8] hover:text-[#3A3F52]">
        <ArrowLeft className="h-4 w-4" />
        Kembali ke login
      </Link>

      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold text-[#3A3F52]">Register Admin</h1>
        <p className="text-sm text-[#9AA3B8]">Buat akun administrator Votely.</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel rounded-2xl border-glow p-6 sm:p-8">
        {error && (
          <Alert variant="destructive" className="mb-4 bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4 border-emerald-200 bg-emerald-50 text-emerald-800">
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nik">NIK</Label>
            <Input id="nik" inputMode="numeric" maxLength={16} value={form.nik} onChange={(event) => updateField("nik", event.target.value)} placeholder="16 digit NIK" disabled={loading} className="h-12 rounded-xl" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tanggalLahir">Tanggal Lahir</Label>
            <Input id="tanggalLahir" type="date" value={form.tanggalLahir} onChange={(event) => updateField("tanggalLahir", event.target.value)} disabled={loading} className="h-12 rounded-xl" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="namaLengkap">Nama Lengkap</Label>
            <Input id="namaLengkap" value={form.namaLengkap} onChange={(event) => updateField("namaLengkap", event.target.value)} placeholder="Nama administrator" disabled={loading} className="h-12 rounded-xl" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={form.password} onChange={(event) => updateField("password", event.target.value)} placeholder="Minimal 8 karakter" disabled={loading} className="h-12 rounded-xl" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
            <Input id="confirmPassword" type="password" value={form.confirmPassword} onChange={(event) => updateField("confirmPassword", event.target.value)} placeholder="Ulangi password" disabled={loading} className="h-12 rounded-xl" />
          </div>
        </div>

        <Button type="submit" className="mt-6 h-12 w-full rounded-xl bg-gradient-to-r from-[#1FD7BE] to-[#17c5ae] text-white" disabled={loading}>
          {loading ? "Mendaftarkan..." : "Daftarkan Admin"}
        </Button>
      </form>
    </div>
  );
}
