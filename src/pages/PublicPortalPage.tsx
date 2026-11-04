import React, { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  Globe,
  Instagram,
  LoaderCircle,
  MessageCircle,
  Moon,
  Search,
  ShoppingBag,
  Sun,
  Youtube,
} from "lucide-react";
import { lookupPublicOrders } from "../services/dbAdapter";
import {
  defaultPortalConfig,
  PortalConfig,
  PublicOrderProgress,
} from "../types/portal";

interface PortalData {
  portal: PortalConfig;
  business: {
    businessName: string;
    tagline?: string;
    logoUrl?: string;
  };
}

function iconForLink(url: string) {
  const host = new URL(url).hostname.toLowerCase();
  if (host.includes("whatsapp") || host.includes("wa.me")) return MessageCircle;
  if (host.includes("instagram")) return Instagram;
  if (host.includes("youtube")) return Youtube;
  if (host.includes("shopee") || host.includes("tokopedia")) return ShoppingBag;
  return Globe;
}

export const PublicPortalPage: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("smartinvoice_portal_theme");
    return savedTheme
      ? savedTheme === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(true);
  const [portalError, setPortalError] = useState("");
  const [logoFailed, setLogoFailed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [lookup, setLookup] = useState("");
  const [lookupOpen, setLookupOpen] = useState(false);
  const [orders, setOrders] = useState<PublicOrderProgress[]>([]);
  const [lookupError, setLookupError] = useState("");
  const [searching, setSearching] = useState(false);
  const themeClass = isDarkMode ? "dark" : "";

  useEffect(() => {
    fetch("/api/portal/config")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || "Portal belum dapat dimuat.");
        }
        setPortalData({
          portal: data.portal || defaultPortalConfig,
          business: data.business,
        });
      })
      .catch((error: Error) => setPortalError(error.message))
      .finally(() => setLoadingPortal(false));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("smartinvoice_auth");
    if (!token) {
      setAuthReady(true);
      return;
    }
    if (token.startsWith("local_")) {
      setIsAdmin(true);
      setAuthReady(true);
      return;
    }

    fetch("/api/auth/session", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => setIsAdmin(response.ok))
      .catch(() => setIsAdmin(false))
      .finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    if (portalData?.business.businessName) {
      document.title = portalData.business.businessName;
    }
    return () => {
      document.title =
        "SmartInvoice - Aplikasi Invoice Profesional & WhatsApp Gateway";
    };
  }, [portalData]);

  const handleLookup = async (event: FormEvent) => {
    event.preventDefault();
    setSearching(true);
    setLookupError("");
    setOrders([]);
    try {
      setOrders(await lookupPublicOrders(lookup));
    } catch (error) {
      setLookupError(
        error instanceof Error ? error.message : "Gagal mencari pesanan.",
      );
    } finally {
      setSearching(false);
    }
  };

  if (loadingPortal) {
    return (
      <main className={`${themeClass} flex min-h-screen items-center justify-center bg-white text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50`}>
        <LoaderCircle className="h-7 w-7 animate-spin text-neutral-500" />
      </main>
    );
  }

  if (!portalData) {
    return (
      <main className={`${themeClass} flex min-h-screen items-center justify-center bg-white p-6 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50`}>
        <p className="max-w-md text-center text-sm text-neutral-600 dark:text-neutral-400">
          {portalError || "Portal belum dapat dimuat."}
        </p>
      </main>
    );
  }

  const { portal, business } = portalData;
  return (
    <main
      className={`portal-page-transition ${themeClass} relative min-h-screen bg-white text-neutral-950 transition-colors duration-500 dark:bg-neutral-950 dark:text-neutral-50 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]`}
    >
      <button
        type="button"
        onClick={() => {
          const nextTheme = isDarkMode ? "light" : "dark";
          localStorage.setItem("smartinvoice_portal_theme", nextTheme);
          setIsDarkMode(nextTheme === "dark");
        }}
        aria-label={
          isDarkMode ? "Beralih ke tema terang" : "Beralih ke tema gelap"
        }
        aria-pressed={isDarkMode}
        title={isDarkMode ? "Tema terang" : "Tema gelap"}
        className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white/90 text-neutral-700 shadow-sm backdrop-blur transition hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-900/90 dark:text-neutral-200 dark:hover:bg-neutral-800 sm:right-6 sm:top-6"
      >
        {isDarkMode ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </button>
      <aside className="portal-brand-panel flex min-h-[30svh] flex-col items-center justify-center border-b border-neutral-200 bg-neutral-50 px-6 py-10 text-center dark:border-neutral-800 dark:bg-neutral-900/60 lg:sticky lg:top-0 lg:h-screen lg:min-h-0 lg:border-b-0 lg:border-r lg:px-12 lg:py-16">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 lg:h-36 lg:w-36">
          <ShoppingBag className="h-10 w-10 lg:h-14 lg:w-14" />
        </div>
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
          Toko resmi
        </p>
        <h1 className="mt-3 max-w-lg text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
          {business.logoUrl && !logoFailed ? (
            <img
              src={business.logoUrl}
              alt={`Logo ${business.businessName}`}
              onError={() => setLogoFailed(true)}
              className="mx-auto max-h-20 max-w-72 object-contain"
            />
          ) : (
            business.businessName || "Toko"
          )}
        </h1>
        {business.tagline && (
          <p className="mt-3 max-w-sm text-base leading-7 text-neutral-600 dark:text-neutral-400">
            {business.tagline}
          </p>
        )}
      </aside>

      <section className="portal-content-panel flex min-h-[70svh] flex-col px-5 py-9 sm:px-10 sm:py-12 lg:min-h-screen lg:px-12 lg:py-16 xl:px-20">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
          <header className="mb-7">
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
              {business.businessName}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {portal.welcomeTitle}
            </h2>
            <p className="mt-3 text-base leading-7 text-neutral-600 dark:text-neutral-400">
              {portal.welcomeMessage}
            </p>
          </header>

          <section className="space-y-3" aria-label="Tautan toko">
            {portal.links.map((link) => {
              const Icon = iconForLink(link.url);
              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex min-h-14 items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3.5 text-neutral-900 transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900 dark:focus-visible:ring-offset-neutral-950"
                >
                  <span className="flex items-center gap-3 text-base font-medium">
                    <Icon className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                    {link.label}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-neutral-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 dark:text-neutral-500" />
                </a>
              );
            })}
            {portal.links.length === 0 && (
              <p className="rounded-lg border border-dashed border-neutral-300 px-5 py-4 text-center text-base text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                Tautan toko akan segera tersedia.
              </p>
            )}
          </section>

          <section className="mt-8 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <button
              type="button"
              aria-expanded={lookupOpen}
              onClick={() => setLookupOpen((open) => !open)}
              className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-500 dark:hover:bg-neutral-900"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">
                <Search className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-base font-semibold">
                  Cek pesanan saya
                </span>
                <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
                  Cari dengan nomor pesanan atau WhatsApp.
                </span>
              </span>
            </button>
            {lookupOpen && (
              <div className="border-t border-neutral-200 p-4 dark:border-neutral-800">
                <form onSubmit={handleLookup} className="flex gap-2">
                  <input
                    value={lookup}
                    onChange={(event) => setLookup(event.target.value)}
                    className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-base outline-none placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:placeholder:text-neutral-500"
                    placeholder="Nomor pesanan atau WhatsApp"
                    required
                  />
                  <button
                    type="submit"
                    disabled={searching}
                    className="flex shrink-0 items-center gap-2 rounded-md bg-neutral-900 px-4 py-2.5 text-base font-medium text-white transition hover:bg-neutral-700 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
                  >
                    {searching ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      "Cari"
                    )}
                  </button>
                </form>
              </div>
            )}

            {lookupError && lookupOpen && (
              <p
                role="alert"
                className="px-4 pb-4 text-base text-red-600 dark:text-red-400"
              >
                {lookupError}
              </p>
            )}

            {lookupOpen && orders.length > 0 && (
              <div className="space-y-4 border-t border-neutral-200 p-4 dark:border-neutral-800">
                {orders.map((order) => (
                  <article
                    key={order.invoiceNumber}
                    className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <h3 className="mb-4 text-base font-semibold">
                      Pesanan {order.invoiceNumber}
                    </h3>
                    <ol className="space-y-0">
                      {order.workflowStages.map((stage, index) => {
                        const done = index < order.currentStage;
                        const current = index === order.currentStage;
                        return (
                          <li
                            key={`${order.invoiceNumber}-${index}`}
                            className="flex gap-3"
                          >
                            <div className="flex w-5 shrink-0 flex-col items-center">
                              <span
                                className={`flex h-5 w-5 items-center justify-center rounded-full ${
                                  done
                                    ? "bg-emerald-600 text-white dark:bg-emerald-500"
                                    : current
                                      ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                                      : "bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                                }`}
                              >
                                {done ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                )}
                              </span>
                              {index < order.workflowStages.length - 1 && (
                                <span
                                  className={`my-1 min-h-5 w-px flex-1 ${
                                    done
                                      ? "bg-emerald-500/60"
                                      : "bg-neutral-200 dark:bg-neutral-800"
                                  }`}
                                />
                              )}
                            </div>
                            <span
                              className={`pb-4 text-base ${
                                done
                                  ? "font-medium text-emerald-700 dark:text-emerald-400"
                                  : current
                                    ? "font-semibold text-neutral-900 dark:text-neutral-100"
                                    : "text-neutral-500 dark:text-neutral-500"
                              }`}
                            >
                              {stage}
                              {current && (
                                <span className="ml-2 text-[13px] text-neutral-500 dark:text-neutral-400">
                                  (Sedang berjalan)
                                </span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                    {order.currentStage >= order.workflowStages.length && (
                      <p className="mt-1 text-base font-medium text-emerald-700 dark:text-emerald-400">
                        Pesanan selesai.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <footer className="mt-auto flex flex-col items-center gap-4 pt-12 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="text-[13px] text-neutral-500 dark:text-neutral-500">
              © {new Date().getFullYear()} {business.businessName}
            </p>
            <Link
              to={isAdmin ? "/dashboard" : "/login"}
              viewTransition
              aria-disabled={!authReady}
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-neutral-200 bg-white px-4 py-2 text-base font-medium text-neutral-900 transition hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 aria-disabled:pointer-events-none aria-disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900 dark:focus-visible:ring-offset-neutral-950"
            >
              {!authReady
                ? "Memeriksa akses..."
                : isAdmin
                  ? "Buka dashboard"
                  : "Login admin"}
            </Link>
          </footer>
        </div>
      </section>
    </main>
  );
};
