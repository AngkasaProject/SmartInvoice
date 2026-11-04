import React, { useState, useEffect } from "react";
import {
  Lock,
  Loader2,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Eye,
  EyeOff,
  ShieldCheck,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
      <main className="auth-page-transition flex min-h-screen items-center justify-center bg-neutral-50 text-neutral-500">
        <Loader2 className="h-7 w-7 animate-spin" aria-label="Memuat halaman login" />
      </main>
    );

  return (
    <main className="auth-page-transition min-h-screen bg-neutral-50 p-4 text-neutral-950 sm:p-8">
      <div className="mx-auto grid min-h-[calc(100svh-2rem)] w-full max-w-6xl overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-xl shadow-neutral-200/50 sm:min-h-[calc(100svh-4rem)] lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-neutral-950 p-10 text-white lg:flex xl:p-14">
          <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full border border-white/10" />
          <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full border border-white/10" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10">
              <Store className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold tracking-wide">
              SmartInvoice
            </span>
          </div>

          <div className="relative max-w-md py-12">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Ruang kerja usahamu
            </p>
            <h2 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
              Semua urusan bisnis, lebih tertata.
            </h2>
            <p className="mt-5 text-base leading-7 text-neutral-300">
              Kelola invoice, pantau pesanan, dan atur informasi tokomu dari
              satu dashboard.
            </p>
          </div>

          <p className="relative text-xs text-neutral-400">
            Invoice dan pesanan, kini dalam kendalimu.
          </p>
        </aside>

        <section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-14 xl:px-20">
          <div className="w-full max-w-md">
            <Link
              to="/"
              viewTransition
              className="mb-10 inline-flex items-center gap-2 rounded-md text-sm font-medium text-neutral-500 transition hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke portal
            </Link>

            <div className="mb-8">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-900 lg:hidden">
                {hasAdmin ? (
                  <Lock className="h-5 w-5" />
                ) : (
                  <ShieldCheck className="h-5 w-5" />
                )}
              </div>
              <p className="text-sm font-medium text-neutral-500">
                SmartInvoice
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                {hasAdmin ? "Selamat datang kembali" : "Amankan tokomu"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                {hasAdmin
                  ? "Masuk untuk melanjutkan ke dashboard usahamu."
                  : "Buat akun admin untuk mulai mengelola tokomu."}
              </p>
            </div>

            {isAnonymous && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-amber-950">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <p className="text-xs leading-5">
                  <strong>Mode anonim aktif.</strong> Akun dan data invoice
                  disimpan di penyimpanan lokal browser ini.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="admin-username"
                  className="mb-2 block text-sm font-medium text-neutral-800"
                >
                  Username
                </label>
                <input
                  id="admin-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                  placeholder="Masukkan username"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="mb-2 block text-sm font-medium text-neutral-800"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={hasAdmin ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 pr-11 text-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                    placeholder="Masukkan password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-neutral-500 transition hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-500"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {!hasAdmin && (
                <div>
                  <label
                    htmlFor="admin-confirm-password"
                    className="mb-2 block text-sm font-medium text-neutral-800"
                  >
                    Konfirmasi password
                  </label>
                  <div className="relative">
                    <input
                      id="admin-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 pr-11 text-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
                      placeholder="Ulangi password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword((visible) => !visible)
                      }
                      aria-label={
                        showConfirmPassword
                          ? "Sembunyikan konfirmasi password"
                          : "Lihat konfirmasi password"
                      }
                      aria-pressed={showConfirmPassword}
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-neutral-500 transition hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-500"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {hasAdmin ? "Masuk ke dashboard" : "Buat akun admin"}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-xs text-neutral-400">
              Akses aman untuk mengelola usahamu.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
};
