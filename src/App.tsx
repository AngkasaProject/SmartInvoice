/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BusinessProfile, Invoice, OpenWaConfig } from './types/invoice';
import {
  loadBusinessProfileFromStorage,
  saveBusinessProfileToStorage,
  loadOpenWaConfigFromStorage,
  saveOpenWaConfigToStorage,
  resetToSampleData,
} from './services/storage';
import {
  deleteInvoiceRecord,
  fetchAllInvoices,
  loadDatabaseSettings,
  saveInvoiceRecord,
} from './services/dbAdapter';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { InvoiceForm } from './components/InvoiceForm';
import { HistoryView } from './components/HistoryView';
import { InvoiceDetailModal } from './components/InvoiceDetailModal';
import { WhatsAppSendModal } from './components/WhatsAppSendModal';
import { SettingsView } from './components/SettingsView';
import { PostSaveActionModal } from './components/PostSaveActionModal';
import { InvoicePrintable } from './components/InvoicePrintable';
import { Toaster, toast } from 'sonner';

export default function App() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [business, setBusiness] = useState<BusinessProfile>(loadBusinessProfileFromStorage);
  const [openWaConfig, setOpenWaConfig] = useState<OpenWaConfig>(loadOpenWaConfigFromStorage);
  const [dbSettings, setDbSettings] = useState(loadDatabaseSettings);

  const [currentView, setCurrentView] = useState<'dashboard' | 'create' | 'edit' | 'history' | 'settings'>('dashboard');
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [whatsAppModalInvoice, setWhatsAppModalInvoice] = useState<Invoice | null>(null);
  const [postSaveInvoice, setPostSaveInvoice] = useState<Invoice | null>(null);

  // Load invoices from active database (Supabase or Local)
  const refreshInvoices = async () => {
    try {
      const data = await fetchAllInvoices();
      setInvoices(data);
      setDbSettings(loadDatabaseSettings());
    } catch (err: any) {
      console.error('Failed to load invoices', err);
      toast.error('Gagal memuat data invoice: ' + err.message);
    }
  };

  useEffect(() => {
    refreshInvoices();
  }, []);

  // Check for incoming store orders from webhook
  useEffect(() => {
    const checkIncomingOrders = async () => {
      try {
        const res = await fetch('/api/orders/webhook');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.orders) && data.orders.length > 0) {
            for (const order of data.orders) {
              await saveInvoiceRecord(order);
              toast.success(`Pesanan Toko Baru Masuk: ${order.invoiceNumber}!`, {
                description: `Customer: ${order.client.name} • Total: Rp ${order.total.toLocaleString('id-ID')}`,
              });
            }
            await refreshInvoices();
          }
        }
      } catch {
        // Ignore polling errors
      }
    };

    const interval = setInterval(checkIncomingOrders, 4000);
    return () => clearInterval(interval);
  }, []);

  // Save changes to active database & local storage
  const handleSaveInvoice = async (invoiceToSave: Invoice, isEditing: boolean) => {
    try {
      await saveInvoiceRecord(invoiceToSave);
      const updatedList = await fetchAllInvoices();
      setInvoices(updatedList);

      setEditingInvoice(null);
      setCurrentView('dashboard');

      if (isEditing) {
        toast.success(`Invoice ${invoiceToSave.invoiceNumber} berhasil diperbarui!`, {
          description: `Customer: ${invoiceToSave.client.name} • ${invoiceToSave.client.phone}`,
        });
      } else {
        toast.success(`Invoice ${invoiceToSave.invoiceNumber} berhasil dibuat!`, {
          description: `Customer: ${invoiceToSave.client.name} • ${invoiceToSave.client.phone}`,
        });
      }

      // Display the post-save popup (allows instant PDF download or WhatsApp send)
      setPostSaveInvoice(invoiceToSave);
    } catch (err: any) {
      toast.error('Gagal menyimpan invoice: ' + err.message);
    }
  };

  const handleTogglePaid = async (invoice: Invoice) => {
    const isNowPaid = invoice.status !== 'paid';
    const updatedInvoice: Invoice = {
      ...invoice,
      status: isNowPaid ? 'paid' : 'unpaid',
      paidAt: isNowPaid ? new Date().toISOString() : undefined,
      paidMethod: isNowPaid ? (invoice.paidMethod || 'Transfer Bank') : undefined,
      updatedAt: new Date().toISOString(),
    };

    await saveInvoiceRecord(updatedInvoice);
    const updated = await fetchAllInvoices();
    setInvoices(updated);

    if (isNowPaid) {
      toast.success(`Invoice ${invoice.invoiceNumber} ditandai LUNAS!`, {
        description: `Pembayaran sebesar Rp ${invoice.total.toLocaleString('id-ID')} telah diverifikasi.`,
      });
    } else {
      toast.info(`Invoice ${invoice.invoiceNumber} diubah ke status BELUM LUNAS.`);
    }

    if (detailInvoice && detailInvoice.id === invoice.id) {
      setDetailInvoice(updatedInvoice);
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    try {
      await deleteInvoiceRecord(id);
      const updated = await fetchAllInvoices();
      setInvoices(updated);
      toast.success('Invoice berhasil dihapus.');
      if (detailInvoice && detailInvoice.id === id) {
        setDetailInvoice(null);
      }
    } catch (err: any) {
      toast.error('Gagal menghapus invoice: ' + err.message);
    }
  };

  const handleDuplicateInvoice = async (invoice: Invoice) => {
    const newNum = `${invoice.invoiceNumber}-COPY`;
    const cloned: Invoice = {
      ...invoice,
      id: 'inv_' + Date.now(),
      invoiceNumber: newNum,
      status: 'draft',
      issueDate: new Date().toISOString().split('T')[0],
      whatsappStatus: 'not_sent',
      whatsappSentAt: undefined,
      whatsappRecipient: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveInvoiceRecord(cloned);
    const updated = await fetchAllInvoices();
    setInvoices(updated);
    setEditingInvoice(cloned);
    setCurrentView('edit');
    toast.info(`Invoice digandakan sebagai ${newNum}. Mode edit dibuka.`);
  };

  const handleOpenEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setDetailInvoice(null);
    setCurrentView('edit');
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
    toast.success(`PDF berhasil dikirim ke nomor WhatsApp customer!`);
  };

  const handleSaveBusinessProfile = (profile: BusinessProfile) => {
    setBusiness(profile);
    saveBusinessProfileToStorage(profile);
  };

  const handleSaveOpenWaConfig = (config: OpenWaConfig) => {
    setOpenWaConfig(config);
    saveOpenWaConfigToStorage(config);
  };

  const handleImportData = async (data: {
    invoices: Invoice[];
    business: BusinessProfile;
    config: OpenWaConfig;
  }) => {
    for (const inv of data.invoices) {
      await saveInvoiceRecord(inv);
    }
    setBusiness(data.business);
    saveBusinessProfileToStorage(data.business);
    if (data.config) {
      setOpenWaConfig(data.config);
      saveOpenWaConfigToStorage(data.config);
    }
    await refreshInvoices();
  };

  const handleResetData = async () => {
    resetToSampleData();
    await refreshInvoices();
    setBusiness(loadBusinessProfileFromStorage());
    setOpenWaConfig(loadOpenWaConfigFromStorage());
  };

  // Hidden print canvas active item (fallback for background PDF rendering)
  const activePrintInvoice =
    postSaveInvoice || whatsAppModalInvoice || detailInvoice || (invoices.length > 0 ? invoices[0] : null);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Toast Notification Container (Sonner) */}
      <Toaster richColors position="top-right" closeButton expand={false} />

      {/* Top Clean & Functional Navbar */}
      <Navbar
        currentView={currentView === 'edit' ? 'create' : currentView}
        onChangeView={(view) => {
          if (view === 'create') {
            setEditingInvoice(null);
          }
          setCurrentView(view);
        }}
        business={business}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 pb-24 md:pb-8">
        {currentView === 'dashboard' && (
          <DashboardView
            invoices={invoices}
            business={business}
            config={openWaConfig}
            onOpenCreate={() => {
              setEditingInvoice(null);
              setCurrentView('create');
            }}
            onOpenDetail={(inv) => setDetailInvoice(inv)}
            onOpenEdit={handleOpenEdit}
            onOpenWhatsApp={handleOpenWhatsAppModal}
            onTogglePaid={handleTogglePaid}
            onDeleteInvoice={handleDeleteInvoice}
            onDuplicateInvoice={handleDuplicateInvoice}
          />
        )}

        {(currentView === 'create' || currentView === 'edit') && (
          <InvoiceForm
            initialInvoice={editingInvoice}
            business={business}
            existingInvoices={invoices}
            onSave={handleSaveInvoice}
            onCancel={() => {
              setEditingInvoice(null);
              setCurrentView('dashboard');
            }}
          />
        )}

        {currentView === 'history' && (
          <HistoryView
            invoices={invoices}
            business={business}
            config={openWaConfig}
            onOpenDetail={(inv) => setDetailInvoice(inv)}
            onOpenWhatsApp={handleOpenWhatsAppModal}
            onOpenEdit={handleOpenEdit}
          />
        )}

        {currentView === 'settings' && (
          <SettingsView
            business={business}
            config={openWaConfig}
            invoices={invoices}
            onSaveBusiness={handleSaveBusinessProfile}
            onSaveConfig={handleSaveOpenWaConfig}
            onImportData={handleImportData}
            onResetData={handleResetData}
            onRefreshData={refreshInvoices}
          />
        )}
      </main>

      {/* Post-Save Modal (Download PDF vs Kirim WhatsApp Customer) */}
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

      {/* Detail / Full PDF Preview Modal */}
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

      {/* WhatsApp OpenWA Automated Send Modal */}
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
            setDetailInvoice(null);
            setCurrentView('settings');
          }}
        />
      )}

      {/* Hidden DOM element for reliable background PDF rendering */}
      {activePrintInvoice && (
        <div className="fixed -left-[9999px] top-0 pointer-events-none opacity-0">
          <InvoicePrintable
            id="printable-invoice-element"
            invoice={activePrintInvoice}
            business={business}
          />
        </div>
      )}
    </div>
  );
}
