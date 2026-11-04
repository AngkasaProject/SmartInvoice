/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import {
  BusinessProfile,
  Invoice,
  InvoiceBackup,
  OpenWaConfig,
} from "./types/invoice";
import {
  defaultBusinessProfile,
  defaultOpenWaConfig,
  defaultStoreApiConfig,
  initialSampleInvoices,
} from "./services/storage";
import {
  deleteInvoiceRecord,
  fetchAllInvoices,
  fetchBusinessProfile,
  fetchOpenWaConfig,
  saveBusinessProfile,
  saveInvoiceRecord,
  saveOpenWaConfig,
  saveStoreApiConfig,
} from "./services/dbAdapter";
import { Navbar } from "./components/Navbar";
import { DashboardView } from "./components/DashboardView";
import { InvoiceForm } from "./components/InvoiceForm";
import { HistoryView } from "./components/HistoryView";
import { InvoiceDetailModal } from "./components/InvoiceDetailModal";
import { WhatsAppSendModal } from "./components/WhatsAppSendModal";
import { SettingsView } from "./components/SettingsView";
import { PostSaveActionModal } from "./components/PostSaveActionModal";
import { InvoicePrintable } from "./components/InvoicePrintable";
import { AuthPage } from "./components/auth/AuthPage";
import { PublicPrintPage } from "./pages/PublicPrintPage"; // <-- Import halaman baru
import { Toaster, toast } from "sonner";

// ==========================================
// KOMPONEN UTAMA APLIKASI (DASHBOARD)
// ==========================================
const MainApp = ({ onLogout }: { onLogout: () => void }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [business, setBusiness] = useState<BusinessProfile>(
    defaultBusinessProfile,
  );
  const [openWaConfig, setOpenWaConfig] =
    useState<OpenWaConfig>(defaultOpenWaConfig);

  const [currentView, setCurrentView] = useState<
    "dashboard" | "create" | "edit" | "history" | "settings"
  >("dashboard");
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [whatsAppModalInvoice, setWhatsAppModalInvoice] =
    useState<Invoice | null>(null);
  const [postSaveInvoice, setPostSaveInvoice] = useState<Invoice | null>(null);

  const refreshInvoices = async () => {
    try {
      const data = await fetchAllInvoices();
      setInvoices(data);
    } catch (err: any) {
      console.error("Failed to load invoices", err);
      toast.error("Gagal memuat data invoice: " + err.message);
    }
  };

  useEffect(() => {
    refreshInvoices();
    fetchBusinessProfile()
      .then((profile) => setBusiness(profile))
      .catch((err: Error) =>
        toast.error(`Gagal memuat profil usaha: ${err.message}`),
      );
    fetchOpenWaConfig()
      .then((config) => setOpenWaConfig(config))
      .catch((err: Error) =>
        toast.error(`Gagal memuat pengaturan WhatsApp: ${err.message}`),
      );
  }, []);

  const handleSaveInvoice = async (
    invoiceToSave: Invoice,
    isEditing: boolean,
  ) => {
    try {
      await saveInvoiceRecord(invoiceToSave);
      const updatedList = await fetchAllInvoices();
      setInvoices(updatedList);

      setEditingInvoice(null);
      setCurrentView("dashboard");

      if (isEditing) {
        toast.success(
          `Invoice ${invoiceToSave.invoiceNumber} berhasil diperbarui!`,
        );
      } else {
        toast.success(
          `Invoice ${invoiceToSave.invoiceNumber} berhasil dibuat!`,
        );
      }

      setPostSaveInvoice(invoiceToSave);
    } catch (err: any) {
      toast.error("Gagal menyimpan invoice: " + err.message);
    }
  };

  const handleTogglePaid = async (invoice: Invoice) => {
    const isNowPaid = invoice.status !== "paid";
    const updatedInvoice: Invoice = {
      ...invoice,
      status: isNowPaid ? "paid" : "unpaid",
      paidAt: isNowPaid ? new Date().toISOString() : undefined,
      paidMethod: isNowPaid ? invoice.paidMethod || "Transfer Bank" : undefined,
      updatedAt: new Date().toISOString(),
    };

    await saveInvoiceRecord(updatedInvoice);
    const updated = await fetchAllInvoices();
    setInvoices(updated);

    if (detailInvoice && detailInvoice.id === invoice.id) {
      setDetailInvoice(updatedInvoice);
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    try {
      await deleteInvoiceRecord(id);
      const updated = await fetchAllInvoices();
      setInvoices(updated);
      toast.success("Invoice berhasil dihapus.");
      if (detailInvoice && detailInvoice.id === id) {
        setDetailInvoice(null);
      }
    } catch (err: any) {
      toast.error("Gagal menghapus invoice: " + err.message);
    }
  };

  const handleDuplicateInvoice = async (invoice: Invoice) => {
    const newNum = `${invoice.invoiceNumber}-COPY`;
    const cloned: Invoice = {
      ...invoice,
      id: "inv_" + Date.now(),
      invoiceNumber: newNum,
      status: "draft",
      issueDate: new Date().toISOString().split("T")[0],
      whatsappStatus: "not_sent",
      whatsappSentAt: undefined,
      whatsappRecipient: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveInvoiceRecord(cloned);
    const updated = await fetchAllInvoices();
    setInvoices(updated);
    setEditingInvoice(cloned);
    setCurrentView("edit");
    toast.info(`Invoice digandakan sebagai ${newNum}.`);
  };

  const handleOpenEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setDetailInvoice(null);
    setCurrentView("edit");
  };

  const handleOpenWhatsAppModal = (invoice: Invoice) => {
    setWhatsAppModalInvoice(invoice);
  };

  const handleWhatsAppSentSuccess = async (updatedInvoice: Invoice) => {
    await saveInvoiceRecord(updatedInvoice);
    const updated = await fetchAllInvoices();
    setInvoices(updated);

    if (detailInvoice && detailInvoice.id === updatedInvoice.id) {
      setDetailInvoice(updatedInvoice);
    }
    setWhatsAppModalInvoice(updatedInvoice);
    toast.success(`PDF berhasil dikirim ke WhatsApp customer!`);
  };

  const handleSaveBusinessProfile = async (profile: BusinessProfile) => {
    setBusiness(profile);
    await saveBusinessProfile(profile);
  };

  const handleSaveOpenWaConfig = async (config: OpenWaConfig) => {
    setOpenWaConfig(config);
    await saveOpenWaConfig(config);
  };

  const handleRestoreData = async (data: InvoiceBackup) => {
    const currentInvoices = await fetchAllInvoices();
    const restoredInvoiceIds = new Set(data.invoices.map((invoice) => invoice.id));
    for (const invoice of data.invoices) {
      await saveInvoiceRecord(invoice);
    }
    for (const invoice of currentInvoices) {
      if (!restoredInvoiceIds.has(invoice.id)) {
        await deleteInvoiceRecord(invoice.id);
      }
    }
    await saveBusinessProfile(data.business);
    await saveOpenWaConfig(data.config);
    await saveStoreApiConfig(data.storeConfig || defaultStoreApiConfig);

    setBusiness(data.business);
    setOpenWaConfig(data.config);
    await refreshInvoices();
  };

  const handleResetData = async () => {
    await handleRestoreData({
      business: defaultBusinessProfile,
      config: defaultOpenWaConfig,
      storeConfig: defaultStoreApiConfig,
      invoices: initialSampleInvoices,
    });
  };

  const activePrintInvoice =
    postSaveInvoice ||
    whatsAppModalInvoice ||
    detailInvoice ||
    (invoices.length > 0 ? invoices[0] : null);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Toaster richColors position="top-right" closeButton expand={false} />

      <Navbar
        currentView={currentView === "edit" ? "create" : currentView}
        onChangeView={(view) => {
          if (view === "create") setEditingInvoice(null);
          setCurrentView(view);
        }}
        business={business}
        onLogout={onLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 pb-24 md:pb-8">
        {currentView === "dashboard" && (
          <DashboardView
            invoices={invoices}
            business={business}
            config={openWaConfig}
            onOpenCreate={() => {
              setEditingInvoice(null);
              setCurrentView("create");
            }}
            onOpenDetail={(inv) => setDetailInvoice(inv)}
            onOpenEdit={handleOpenEdit}
            onOpenWhatsApp={handleOpenWhatsAppModal}
            onTogglePaid={handleTogglePaid}
            onDeleteInvoice={handleDeleteInvoice}
            onDuplicateInvoice={handleDuplicateInvoice}
          />
        )}

        {(currentView === "create" || currentView === "edit") && (
          <InvoiceForm
            initialInvoice={editingInvoice}
            business={business}
            existingInvoices={invoices}
            onSave={handleSaveInvoice}
            onCancel={() => {
              setEditingInvoice(null);
              setCurrentView("dashboard");
            }}
          />
        )}

        {currentView === "history" && (
          <HistoryView
            invoices={invoices}
            business={business}
            config={openWaConfig}
            onOpenDetail={(inv) => setDetailInvoice(inv)}
            onOpenWhatsApp={handleOpenWhatsAppModal}
            onOpenEdit={handleOpenEdit}
          />
        )}

        {currentView === "settings" && (
          <SettingsView
            business={business}
            config={openWaConfig}
            invoices={invoices}
            onSaveBusiness={handleSaveBusinessProfile}
            onSaveConfig={handleSaveOpenWaConfig}
            onRestoreData={handleRestoreData}
            onResetData={handleResetData}
            onRefreshData={refreshInvoices}
          />
        )}
      </main>

      <PostSaveActionModal
        invoice={postSaveInvoice}
        isOpen={Boolean(postSaveInvoice)}
        onClose={() => setPostSaveInvoice(null)}
        onDownload={() => {}}
        onSendWhatsApp={(inv) => {
          setPostSaveInvoice(null);
          setWhatsAppModalInvoice(inv);
        }}
        onViewDetail={(inv) => {
          setPostSaveInvoice(null);
          setDetailInvoice(inv);
        }}
      />

      <InvoiceDetailModal
        invoice={detailInvoice}
        business={business}
        config={openWaConfig}
        isOpen={Boolean(detailInvoice)}
        onClose={() => setDetailInvoice(null)}
        onEdit={handleOpenEdit}
        onDelete={handleDeleteInvoice}
        onTogglePaid={handleTogglePaid}
        onOpenWhatsAppModal={handleOpenWhatsAppModal}
        onDuplicate={handleDuplicateInvoice}
      />

      {whatsAppModalInvoice && (
        <WhatsAppSendModal
          invoice={whatsAppModalInvoice}
          business={business}
          config={openWaConfig}
          isOpen={Boolean(whatsAppModalInvoice)}
          onClose={() => setWhatsAppModalInvoice(null)}
          onSentSuccess={handleWhatsAppSentSuccess}
          onOpenSettings={() => {
            setWhatsAppModalInvoice(null);
            setCurrentView("settings");
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          left: "-9999px",
          top: 0,
          width: "820px",
          zIndex: -1,
        }}
        aria-hidden="true"
      >
        {activePrintInvoice && (
          <InvoicePrintable
            id="printable-invoice-element"
            invoice={activePrintInvoice}
            business={business}
            documentType="invoice"
          />
        )}
        {activePrintInvoice?.status === "paid" && (
          <InvoicePrintable
            id="printable-receipt-element"
            invoice={activePrintInvoice}
            business={business}
            documentType="kwitansi"
          />
        )}
      </div>
    </div>
  );
};

// ==========================================
// APP UTAMA (ROUTING)
// ==========================================
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(
      localStorage.getItem("smartinvoice_auth")?.startsWith("local_"),
    );
  });
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(() => {
    const token = localStorage.getItem("smartinvoice_auth");
    return Boolean(token && !token.startsWith("local_"));
  });

  useEffect(() => {
    const token = localStorage.getItem("smartinvoice_auth");
    if (!token || token.startsWith("local_")) return;

    fetch("/api/auth/session", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.success) {
          localStorage.removeItem("smartinvoice_auth");
          setIsAuthenticated(false);
          return;
        }
        setIsAuthenticated(true);
      })
      .catch(() => {
        localStorage.removeItem("smartinvoice_auth");
        setIsAuthenticated(false);
      })
      .finally(() => setIsAuthLoading(false));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("smartinvoice_auth");
    setIsAuthenticated(false);
    toast.info("Anda telah logout.");
  };

  return (
    <>
      <Toaster richColors position="top-right" closeButton expand={false} />
      <Routes>
        {/* RUTE PUBLIK (Tanpa Login) */}
        <Route path="/print/:id" element={<PublicPrintPage />} />

        {/* RUTE UTAMA (Dengan Login) */}
        <Route
          path="/*"
          element={
            isAuthLoading ? (
              <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">
                Memeriksa sesi...
              </div>
            ) : isAuthenticated ? (
              <MainApp onLogout={handleLogout} />
            ) : (
              <AuthPage onLoginSuccess={() => setIsAuthenticated(true)} />
            )
          }
        />
      </Routes>
    </>
  );
}
