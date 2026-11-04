import React, { useState, useEffect } from "react";
import { DatabaseConfig, DatabaseDriver } from "../../types/invoice";
import {
  defaultDatabaseConfig,
  fetchDatabaseConfig,
  generateSupabaseSqlSchema,
  migrateDatabase,
  saveDatabaseConfig,
  testDatabaseConnection,
} from "../../services/dbAdapter";
import {
  Database,
  Server,
  HardDrive,
  Cloud,
  Save,
  RefreshCw,
  Loader2,
  ArrowRightLeft,
  Copy,
  Check,
  FileCode,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

interface DatabaseSettingsProps {
  onRefreshData?: () => void;
}

export const DatabaseSettings: React.FC<DatabaseSettingsProps> = ({
  onRefreshData,
}) => {
  const [dbSettings, setDbSettings] = useState<DatabaseConfig>(
    defaultDatabaseConfig,
  );
  const [isEnvLocked, setIsEnvLocked] = useState(false);
  const [canMigrate, setCanMigrate] = useState(false);
  const [showSupabaseKey, setShowSupabaseKey] = useState(false);

  // Test states
  const [sqliteTestStatus, setSqliteTestStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [sqliteTestMsg, setSqliteTestMsg] = useState("");
  const [d1TestStatus, setD1TestStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [d1TestMsg, setD1TestMsg] = useState("");
  const [neonTestStatus, setNeonTestStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [neonTestMsg, setNeonTestMsg] = useState("");
  const [supabaseTestStatus, setSupabaseTestStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [supabaseTestMsg, setSupabaseTestMsg] = useState("");

  // Migration states
  const [migrateFrom, setMigrateFrom] = useState<DatabaseDriver>("sqlite");
  const [migrateTo, setMigrateTo] = useState<DatabaseDriver>("neon");
  const [isMigrating, setIsMigrating] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    fetchDatabaseConfig().then((res) => {
      setDbSettings(res.config);
      setIsEnvLocked(res.isEnvLocked);
      setCanMigrate(res.canMigrate);
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEnvLocked)
      return toast.error("Konfigurasi dikunci oleh Environment Variable.");
    if (
      dbSettings.activeDriver === "neon" &&
      !dbSettings.neon.configured
    ) {
      return toast.error("Atur NEON_DATABASE_URL sebelum memilih Neon.");
    }

    const res = await saveDatabaseConfig(dbSettings);
    if (res.success) {
      toast.success(
        `Pengaturan database disimpan! Mode aktif: ${dbSettings.activeDriver}`,
      );
      if (onRefreshData) onRefreshData();
    } else {
      toast.error(res.message);
    }
  };

  const handleTestSqlite = async () => {
    setSqliteTestStatus("loading");
    setSqliteTestMsg("");
    const res = await testDatabaseConnection("sqlite");
    setSqliteTestStatus(res.success ? "success" : "error");
    setSqliteTestMsg(res.message);
    res.success ? toast.success(res.message) : toast.error(res.message);
  };

  const handleTestD1 = async () => {
    setD1TestStatus("loading");
    setD1TestMsg("");
    const res = await testDatabaseConnection("d1");
    setD1TestStatus(res.success ? "success" : "error");
    setD1TestMsg(res.message);
    res.success ? toast.success(res.message) : toast.error(res.message);
  };

  const handleTestNeon = async () => {
    setNeonTestStatus("loading");
    setNeonTestMsg("");
    const res = await testDatabaseConnection("neon");
    setNeonTestStatus(res.success ? "success" : "error");
    setNeonTestMsg(res.message);
    res.success ? toast.success(res.message) : toast.error(res.message);
  };

  const handleTestSupabase = async () => {
    setSupabaseTestStatus("loading");
    setSupabaseTestMsg("");
    const res = await testDatabaseConnection("supabase", dbSettings.supabase);
    setSupabaseTestStatus(res.success ? "success" : "error");
    setSupabaseTestMsg(res.message);
    res.success ? toast.success(res.message) : toast.error(res.message);
  };

  const handleMigrate = async () => {
    if (!canMigrate) return toast.error("Migrasi tidak tersedia di runtime ini.");
    if (migrateFrom === migrateTo)
      return toast.error("Sumber dan tujuan tidak boleh sama.");
    setIsMigrating(true);
    toast.info(`Migrasi dari ${migrateFrom} ke ${migrateTo}...`);
    const res = await migrateDatabase(migrateFrom, migrateTo);
    setIsMigrating(false);
    res.success ? toast.success(res.message) : toast.error(res.message);
    if (res.success && onRefreshData) onRefreshData();
  };

  return (
    <form
      onSubmit={handleSave}
      className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6"
    >
      {/* Banner Peringatan Jika Dikunci ENV */}
      {isEnvLocked && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
          <Lock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-blue-900">
              Konfigurasi Dikelola oleh Environment Variable
            </h3>
            <p className="text-xs text-blue-700 mt-1">
              Database dikonfigurasi lewat environment secret atau binding
              deployment, sehingga pengaturannya dikunci dari UI.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-600" /> Database Server
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pilihan real working database server.
          </p>
        </div>
        {!isEnvLocked && (
          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Simpan Database
          </button>
        )}
      </div>

      <div
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${isEnvLocked ? "opacity-50 pointer-events-none" : ""}`}
      >
        {/* SQLite Card */}
        <div
          onClick={() =>
            !isEnvLocked &&
            setDbSettings({ ...dbSettings, activeDriver: "sqlite" })
          }
          className={`cursor-pointer p-4 rounded-xl border-2 transition ${dbSettings.activeDriver === "sqlite" ? "border-emerald-600 bg-emerald-50/40" : "border-slate-200 bg-white"}`}
        >
          <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <HardDrive className="w-4 h-4" /> SQLite
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            File lokal, zero-config.
          </p>
        </div>
        {/* Cloudflare D1 Card */}
        <div
          onClick={() =>
            !isEnvLocked &&
            toast.info("D1 hanya tersedia di Cloudflare Workers melalui binding Wrangler.")
          }
          className={`cursor-pointer p-4 rounded-xl border-2 transition ${dbSettings.activeDriver === "d1" ? "border-orange-600 bg-orange-50/40" : "border-slate-200 bg-white"}`}
        >
          <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <Cloud className="w-4 h-4" /> Cloudflare D1
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            SQLite terkelola untuk Workers.
          </p>
        </div>
        {/* Supabase Card */}
        <div
          onClick={() =>
            !isEnvLocked &&
            setDbSettings({ ...dbSettings, activeDriver: "supabase" })
          }
          className={`cursor-pointer p-4 rounded-xl border-2 transition ${dbSettings.activeDriver === "supabase" ? "border-blue-600 bg-blue-50/40" : "border-slate-200 bg-white"}`}
        >
          <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <Cloud className="w-4 h-4" /> Supabase
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Cloud PostgreSQL.</p>
        </div>
        {/* Neon Card */}
        <div
          onClick={() =>
            !isEnvLocked &&
            setDbSettings({ ...dbSettings, activeDriver: "neon" })
          }
          className={`cursor-pointer p-4 rounded-xl border-2 transition ${dbSettings.activeDriver === "neon" ? "border-emerald-600 bg-emerald-50/40" : "border-slate-200 bg-white"}`}
        >
          <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <Server className="w-4 h-4" /> Neon
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            PostgreSQL serverless.
          </p>
        </div>
      </div>

      {/* SQLite Form */}
      {dbSettings.activeDriver === "sqlite" && (
        <div
          className={`p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3 ${isEnvLocked ? "opacity-50 pointer-events-none" : ""}`}
        >
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Lokasi File Database
            </label>
            <input
              type="text"
              value={dbSettings.sqlite.filePath}
              onChange={(e) =>
                setDbSettings({
                  ...dbSettings,
                  sqlite: { ...dbSettings.sqlite, filePath: e.target.value },
                })
              }
              className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-white"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleTestSqlite}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white flex items-center gap-2"
            >
              {sqliteTestStatus === "loading" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              )}{" "}
              Tes SQLite
            </button>
          </div>
          {sqliteTestMsg && (
            <div
              className={`p-3 rounded-xl text-xs ${sqliteTestStatus === "success" ? "bg-emerald-100 text-emerald-900" : "bg-rose-50 text-rose-900"}`}
            >
              {sqliteTestMsg}
            </div>
          )}
        </div>
      )}

      {/* Supabase Form */}
      {dbSettings.activeDriver === "supabase" && (
        <div
          className={`p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 ${isEnvLocked ? "opacity-50 pointer-events-none" : ""}`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Project URL
              </label>
              <input
                type="text"
                value={dbSettings.supabase.url}
                onChange={(e) =>
                  setDbSettings({
                    ...dbSettings,
                    supabase: { ...dbSettings.supabase, url: e.target.value },
                  })
                }
                className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Anon Key
              </label>
              <div className="relative">
                <input
                  type={showSupabaseKey ? "text" : "password"}
                  value={dbSettings.supabase.anonKey}
                  onChange={(e) =>
                    setDbSettings({
                      ...dbSettings,
                      supabase: {
                        ...dbSettings.supabase,
                        anonKey: e.target.value,
                      },
                    })
                  }
                  className="w-full text-xs font-mono p-2.5 pr-9 rounded-lg border border-slate-200"
                />
                <button
                  type="button"
                  onClick={() => setShowSupabaseKey(!showSupabaseKey)}
                  className="absolute right-2.5 top-2.5 text-slate-400"
                >
                  {showSupabaseKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleTestSupabase}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white flex items-center gap-2"
            >
              {supabaseTestStatus === "loading" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
              )}{" "}
              Tes Supabase
            </button>
          </div>
          {supabaseTestMsg && (
            <div
              className={`p-3 rounded-xl text-xs ${supabaseTestStatus === "success" ? "bg-emerald-100 text-emerald-900" : "bg-rose-50 text-rose-900"}`}
            >
              {supabaseTestMsg}
            </div>
          )}
        </div>
      )}

      {dbSettings.activeDriver === "d1" && (
        <div className="p-4 bg-orange-50 rounded-xl border border-orange-200 text-xs text-orange-900 space-y-3">
          <p>
            D1 dikelola melalui binding <code>DB</code> di{" "}
            <code>wrangler.toml</code>. Untuk upload logo dan QRIS, binding R2{" "}
            <code>R2_BUCKET</code> juga harus dikonfigurasi.
          </p>
          <button
            type="button"
            onClick={handleTestD1}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white flex items-center gap-2"
          >
            {d1TestStatus === "loading" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-orange-400" />
            )}{" "}
            Tes D1
          </button>
          {d1TestMsg && (
            <div
              className={`p-3 rounded-xl text-xs ${d1TestStatus === "success" ? "bg-emerald-100 text-emerald-900" : "bg-rose-50 text-rose-900"}`}
            >
              {d1TestMsg}
            </div>
          )}
        </div>
      )}

      {dbSettings.activeDriver === "neon" && (
        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-3">
          <p className="text-xs text-emerald-950">
            Simpan connection string Neon sebagai secret <code>NEON_DATABASE_URL</code>{" "}
            di environment server/Workers. Secret tidak disimpan atau dikirim
            melalui UI.
          </p>
          <p className="text-xs text-emerald-800">
            Status: {dbSettings.neon.configured ? "connection string terdeteksi" : "belum terdeteksi"}
          </p>
          <button
            type="button"
            onClick={handleTestNeon}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white flex items-center gap-2"
          >
            {neonTestStatus === "loading" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            )}{" "}
            Tes Neon
          </button>
          {neonTestMsg && (
            <div
              className={`p-3 rounded-xl text-xs ${neonTestStatus === "success" ? "bg-emerald-100 text-emerald-900" : "bg-rose-50 text-rose-900"}`}
            >
              {neonTestMsg}
            </div>
          )}
        </div>
      )}

      {/* Migration Tool */}
      {canMigrate && (
        <div className="p-5 bg-gradient-to-br from-indigo-50/50 to-blue-50/40 rounded-xl border border-indigo-100 space-y-4">
          <h3 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
            <ArrowRightLeft className="w-4 h-4 text-indigo-600" /> Alat Migrasi
            Database
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Dari:
              </label>
              <select
                value={migrateFrom}
                onChange={(e) =>
                  setMigrateFrom(e.target.value as DatabaseDriver)
                }
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200"
              >
                <option value="sqlite">SQLite</option>
                <option value="supabase">Supabase</option>
                <option value="neon">Neon</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Ke:
              </label>
              <select
                value={migrateTo}
                onChange={(e) => setMigrateTo(e.target.value as DatabaseDriver)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200"
              >
                <option value="sqlite">SQLite</option>
                <option value="supabase">Supabase</option>
                <option value="neon">Neon</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleMigrate}
              disabled={isMigrating || migrateFrom === migrateTo}
              className="w-full px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {isMigrating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRightLeft className="w-4 h-4" />
              )}{" "}
              Migrasi Data
            </button>
          </div>
        </div>
      )}
    </form>
  );
};
