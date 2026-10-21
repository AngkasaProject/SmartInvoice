import React, { useState, useEffect } from "react";
import {
  Lock,
  Loader2,
  ArrowRight,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

interface AuthPageProps {
  onLoginSuccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasAdmin, setHasAdmin] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          // Cek apakah ada admin lokal di localStorage (Mode Anonim)
          const localAdmin = localStorage.getItem("smartinvoice_local_admin");

          if (data.isAnonymous && localAdmin) {
            // Jika mode anonim dan sudah ada admin lokal, tampilkan form Login
            setHasAdmin(true);
          } else {
            setHasAdmin(data.hasAdmin);
          }
          setIsAnonymous(data.isAnonymous);
        }
      })
      .catch(() => toast.error("Gagal cek status server."))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasAdmin && password !== confirmPassword) {
      return toast.error("Password dan Konfirmasi Password tidak cocok!");
    }

    setIsSubmitting(true);

    try {
      // ==========================================
      // LOGIKA MODE ANONIM (Tanpa API/Server)
      // ==========================================
      if (isAnonymous) {
        if (!hasAdmin) {
          // Buat Admin Lokal
          const localAdmin = { username, password };
          localStorage.setItem(
            "smartinvoice_local_admin",
            JSON.stringify(localAdmin),
          );

          toast.success("Akun Admin Lokal berhasil dibuat! Silakan login.");
          setHasAdmin(true);
          setPassword("");
          setConfirmPassword("");
        } else {
          // Login Admin Lokal
          const storedAdmin = localStorage.getItem("smartinvoice_local_admin");
          if (storedAdmin) {
            const parsed = JSON.parse(storedAdmin);
            if (parsed.username === username && parsed.password === password) {
              localStorage.setItem("smartinvoice_auth", `local_${Date.now()}`);
              toast.success("Login berhasil (Mode Anonim)!");
              onLoginSuccess();
            } else {
              toast.error("Username atau Password salah!");
            }
          } else {
            toast.error("Akun admin lokal tidak ditemukan.");
          }
        }
        setIsSubmitting(false);
        return;
      }

      // ==========================================
      // LOGIKA NORMAL (Dengan Database/Supabase)
      // ==========================================
      const endpoint = hasAdmin ? "/api/auth/login" : "/api/auth/setup";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (!hasAdmin) {
          toast.success("Akun Admin berhasil dibuat! Silakan login.");
          setHasAdmin(true);
          setPassword("");
          setConfirmPassword("");
        } else {
          localStorage.setItem("smartinvoice_auth", data.token);
          toast.success("Login berhasil!");
          onLoginSuccess();
        }
      } else {
        toast.error(data.message || "Terjadi kesalahan.");
      }
    } catch {
      toast.error("Gagal terhubung ke server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-emerald-600 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-200">
            {hasAdmin ? (
              <Lock className="w-8 h-8" />
            ) : (
              <ShieldCheck className="w-8 h-8" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {hasAdmin ? "Login Admin" : "Setup Admin Pertama"}
          </h1>
          <p className="text-sm text-slate-500 mt-1 text-center">
            {hasAdmin
              ? "Masukkan kredensial Anda untuk masuk."
              : "Buat akun admin untuk mengamankan aplikasi."}
          </p>
        </div>

        {isAnonymous && (
          <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-relaxed">
              <strong>Mode Anonim Aktif:</strong> Database tidak terdeteksi.
              Akun & data invoice Anda akan disimpan di <em>LocalStorage</em>{" "}
              browser ini.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              placeholder="admin"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              placeholder="••••••••"
              required
            />
          </div>

          {/* INPUT KONFIRMASI PASSWORD (Hanya muncul saat Setup) */}
          {!hasAdmin && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Konfirmasi Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                placeholder="••••••••"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition mt-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {hasAdmin ? "Login" : "Buat Admin"}{" "}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
