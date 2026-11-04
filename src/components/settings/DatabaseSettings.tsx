import React, { useState, useEffect } from "react";
import { DatabaseConfig, DatabaseDriver } from "../../types/invoice";
import {
  defaultDatabaseConfig,
  fetchDatabaseConfig,
  generateSupabaseSqlSchema,
  migrateDatabase,
  saveDatabaseConfig,
  testDatabaseConnection,
  testObjectStorageConnection,
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
  const [isWorkersRuntime, setIsWorkersRuntime] = useState(false);
  const [showSupabaseKey, setShowSupabaseKey] = useState(false);
  const [showNeonConnectionString, setShowNeonConnectionString] =
    useState(false);
  const [showNeonStorageSecret, setShowNeonStorageSecret] = useState(false);

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
  const [objectStorageTestStatus, setObjectStorageTestStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [objectStorageTestMsg, setObjectStorageTestMsg] = useState("");

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
      setIsWorkersRuntime(Boolean(res.isWorkersRuntime));
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEnvLocked)
      return toast.error("Konfigurasi dikunci oleh Environment Variable.");
    if (
      dbSettings.activeDriver === "neon" &&
      ((!dbSettings.neon.connectionString && !dbSettings.neon.configured) ||
        (!dbSettings.neon.storageConfigured &&
          (!dbSettings.neon.storageEndpoint ||
            !dbSettings.neon.storageRegion ||
            !dbSettings.neon.storageBucket ||
            !dbSettings.neon.storageAccessKeyId ||
            !dbSettings.neon.storageSecretAccessKey)))
    ) {
      return toast.error(
        "Connection string dan kredensial Neon Object Storage wajib dikonfigurasi.",
      );
    }
    if (
      dbSettings.activeDriver === "supabase" &&
      (!dbSettings.supabase.url ||
        (!dbSettings.supabase.anonKey && !dbSettings.supabase.configured))
    ) {
      return toast.error("URL dan Anon Key Supabase wajib dikonfigurasi.");
    }

    const res = await saveDatabaseConfig(dbSettings);
    if (res.success) {
      setDbSettings(res.config);
      toast.success(
        `Pengaturan database disimpan! Mode aktif: ${res.config.activeDriver}`,
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
    const res = await testDatabaseConnection("neon", {
      connectionString: dbSettings.neon.connectionString,
    });
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

  const handleTestObjectStorage = async () => {
    const provider = dbSettings.activeDriver;
    if (provider !== "neon" && provider !== "supabase") return;
    setObjectStorageTestStatus("loading");
    setObjectStorageTestMsg("");
    const credentials: Record<string, string> =
      provider === "neon"
        ? {
            endpoint: dbSettings.neon.storageEndpoint || "",
            region: dbSettings.neon.storageRegion || "",
            bucket: dbSettings.neon.storageBucket || "",
            accessKeyId: dbSettings.neon.storageAccessKeyId || "",
            secretAccessKey: dbSettings.neon.storageSecretAccessKey || "",
          }
        : {
            url: dbSettings.supabase.url,
            anonKey: dbSettings.supabase.anonKey,
            bucket: dbSettings.supabase.storageBucket || "",
          };
    const res = await testObjectStorageConnection(provider, credentials);
    setObjectStorageTestStatus(res.success ? "success" : "error");
    setObjectStorageTestMsg(res.message);
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
            SQLite/D1 tetap menyimpan konfigurasi dan akun admin. Data aplikasi
            memakai database yang dipilih; pergantian driver tidak menyalin data.
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
            (isWorkersRuntime
              ? toast.info("SQLite hanya tersedia di server Bun/Docker.")
              : setDbSettings({ ...dbSettings, activeDriver: "sqlite" }))
          }
          className={`${isWorkersRuntime ? "cursor-not-allowed opacity-60" : "cursor-pointer"} p-4 rounded-xl border-2 transition ${dbSettings.activeDriver === "sqlite" ? "border-emerald-600 bg-emerald-50/40" : "border-slate-200 bg-white"}`}
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
            (isWorkersRuntime
              ? setDbSettings({ ...dbSettings, activeDriver: "d1" })
              : toast.info("D1 hanya tersedia di Cloudflare Workers melalui binding Wrangler."))
          }
          className={`${isWorkersRuntime ? "cursor-pointer" : "cursor-not-allowed opacity-60"} p-4 rounded-xl border-2 transition ${dbSettings.activeDriver === "d1" ? "border-orange-600 bg-orange-50/40" : "border-slate-200 bg-white"}`}
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
                placeholder="https://project.supabase.co"
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
                  placeholder={
                    dbSettings.supabase.configured
                      ? "Sudah tersimpan; kosongkan untuk mempertahankan"
                      : "Masukkan Supabase Anon Key"
                  }
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
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Supabase Storage bucket
              </label>
              <input
                type="text"
                value={dbSettings.supabase.storageBucket || ""}
                onChange={(e) =>
                  setDbSettings({
                    ...dbSettings,
                    supabase: {
                      ...dbSettings.supabase,
                      storageBucket: e.target.value,
                    },
                  })
                }
                className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Upload gambar memakai Supabase Storage dengan URL dan Anon Key di
            atas. Bucket harus sudah dibuat dan kebijakannya mengizinkan upload
            serta baca publik.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleTestObjectStorage}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white flex items-center gap-2"
            >
              {objectStorageTestStatus === "loading" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
              )}{" "}
              Tes Supabase Storage
            </button>
            <button
              type="button"
              onClick={handleTestSupabase}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 flex items-center gap-2"
            >
              Tes koneksi database
            </button>
          </div>
          {objectStorageTestMsg && (
            <div
              className={`p-3 rounded-xl text-xs ${objectStorageTestStatus === "success" ? "bg-emerald-100 text-emerald-900" : "bg-rose-50 text-rose-900"}`}
            >
              {objectStorageTestMsg}
            </div>
          )}
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
            Connection string disimpan di database default (SQLite/D1) dan
            tidak pernah ditampilkan kembali setelah tersimpan.
          </p>
          <p className="text-xs text-emerald-800">
            Status: {dbSettings.neon.configured ? "connection string tersimpan" : "belum dikonfigurasi"}
          </p>
          <div className="relative">
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Connection string Neon
            </label>
            <input
              type={showNeonConnectionString ? "text" : "password"}
              value={dbSettings.neon.connectionString || ""}
              placeholder={
                dbSettings.neon.configured
                  ? "Sudah tersimpan; kosongkan untuk mempertahankan"
                  : "postgresql://..."
              }
              onChange={(e) =>
                setDbSettings({
                  ...dbSettings,
                  neon: {
                    ...dbSettings.neon,
                    connectionString: e.target.value,
                  },
                })
              }
              className="w-full text-xs font-mono p-2.5 pr-9 rounded-lg border border-slate-200"
            />
            <button
              type="button"
              onClick={() =>
                setShowNeonConnectionString(!showNeonConnectionString)
              }
              className="absolute right-2.5 bottom-2.5 text-slate-400"
            >
              {showNeonConnectionString ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="border-t border-emerald-200 pt-3 space-y-3">
            <h3 className="text-xs font-bold text-emerald-950">
              Neon Object Storage
            </h3>
            <p className="text-[11px] text-emerald-900">
              Buat bucket di Neon Console, lalu masukkan endpoint branch, region,
              nama bucket, Access Key ID, dan Secret Access Key dengan scope
              <code> storage:read </code> serta <code>storage:write</code>.
              Kredensial storage disimpan di database default dan tidak
              ditampilkan lagi setelah tersimpan.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-[11px] font-semibold text-slate-700">
                S3 endpoint
                <input
                  type="url"
                  value={dbSettings.neon.storageEndpoint || ""}
                  placeholder="https://br-....storage.c-....aws.neon.tech"
                  onChange={(e) =>
                    setDbSettings({
                      ...dbSettings,
                      neon: {
                        ...dbSettings.neon,
                        storageEndpoint: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200"
                />
              </label>
              <label className="text-[11px] font-semibold text-slate-700">
                Region
                <input
                  type="text"
                  value={dbSettings.neon.storageRegion || ""}
                  placeholder="us-east-2"
                  onChange={(e) =>
                    setDbSettings({
                      ...dbSettings,
                      neon: {
                        ...dbSettings.neon,
                        storageRegion: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200"
                />
              </label>
              <label className="text-[11px] font-semibold text-slate-700">
                Bucket
                <input
                  type="text"
                  value={dbSettings.neon.storageBucket || ""}
                  onChange={(e) =>
                    setDbSettings({
                      ...dbSettings,
                      neon: {
                        ...dbSettings.neon,
                        storageBucket: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200"
                />
              </label>
              <label className="text-[11px] font-semibold text-slate-700">
                Access Key ID
                <input
                  type="text"
                  value={dbSettings.neon.storageAccessKeyId || ""}
                  placeholder={
                    dbSettings.neon.storageConfigured
                      ? "Sudah tersimpan"
                      : "nak_live_..."
                  }
                  onChange={(e) =>
                    setDbSettings({
                      ...dbSettings,
                      neon: {
                        ...dbSettings.neon,
                        storageAccessKeyId: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200"
                />
              </label>
              <label className="text-[11px] font-semibold text-slate-700 sm:col-span-2">
                Secret Access Key
                <span className="relative block">
                  <input
                    type={showNeonStorageSecret ? "text" : "password"}
                    value={dbSettings.neon.storageSecretAccessKey || ""}
                    placeholder={
                      dbSettings.neon.storageConfigured
                        ? "Sudah tersimpan; kosongkan untuk mempertahankan"
                        : "nsk_live_..."
                    }
                    onChange={(e) =>
                      setDbSettings({
                        ...dbSettings,
                        neon: {
                          ...dbSettings.neon,
                          storageSecretAccessKey: e.target.value,
                        },
                      })
                    }
                    className="mt-1 w-full text-xs font-mono p-2.5 pr-9 rounded-lg border border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowNeonStorageSecret(!showNeonStorageSecret)
                    }
                    className="absolute right-2.5 top-3 text-slate-400"
                  >
                    {showNeonStorageSecret ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </span>
              </label>
            </div>
            <p className="text-[11px] text-emerald-900">
              Status: {dbSettings.neon.storageConfigured ? "Neon Object Storage tersimpan" : "belum dikonfigurasi"}.
              File diakses melalui aplikasi, jadi bucket dapat tetap private.
            </p>
            <button
              type="button"
              onClick={handleTestObjectStorage}
              disabled={objectStorageTestStatus === "loading"}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white flex items-center gap-2 disabled:opacity-50"
            >
              {objectStorageTestStatus === "loading" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              )}
              Tes Neon Object Storage
            </button>
            {objectStorageTestMsg && (
              <div
                className={`p-3 rounded-xl text-xs ${objectStorageTestStatus === "success" ? "bg-emerald-100 text-emerald-900" : "bg-rose-50 text-rose-900"}`}
              >
                {objectStorageTestMsg}
              </div>
            )}
          </div>
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
