import React, { useState, useEffect } from "react";
import {
  Building2,
  ShoppingBag,
  Server,
  Database,
  Download,
} from "lucide-react";
import {
  BusinessProfile,
  Invoice,
  WhatsAppConfig,
  StoreApiConfig,
} from "../types/invoice";
import { fetchStoreApiConfig, saveStoreApiConfig } from "../services/dbAdapter";

// Import komponen tab yang sudah dipecah
import { BusinessSettings } from "./settings/BusinessSettings";
import { StoreSettings } from "./settings/StoreSettings";
import { WhatsAppSettings } from "./settings/WhatsAppSettings";
import { DatabaseSettings } from "./settings/DatabaseSettings";
import { BackupSettings } from "./settings/BackupSettings";

interface SettingsViewProps {
  business: BusinessProfile;
  config: WhatsAppConfig;
  invoices: Invoice[];
  onSaveBusiness: (updated: BusinessProfile) => void;
  onSaveConfig: (updated: WhatsAppConfig) => void;
  onImportData: (data: any) => void;
  onResetData: () => void;
  onRefreshData?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = (props) => {
  const [activeTab, setActiveTab] = useState<
    "business" | "store" | "whatsapp" | "database" | "data"
  >("business");
  const [storeConfig, setStoreConfig] = useState<StoreApiConfig | null>(null);

  useEffect(() => {
    fetchStoreApiConfig().then(setStoreConfig);
  }, []);

  const handleSaveStoreApi = async (updated: StoreApiConfig) => {
    await saveStoreApiConfig(updated);
    setStoreConfig(updated);
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigasi */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex border-b border-slate-100 pb-1.5 mb-1.5 overflow-x-auto gap-1">
          <button
            onClick={() => setActiveTab("business")}
            className={`flex items-center gap-2 py-2 px-3 text-xs font-bold rounded-xl transition ${activeTab === "business" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <Building2 className="w-4 h-4" /> Profil Usaha
          </button>
          <button
            onClick={() => setActiveTab("store")}
            className={`flex items-center gap-2 py-2 px-3 text-xs font-bold rounded-xl transition ${activeTab === "store" ? "bg-purple-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <ShoppingBag className="w-4 h-4" /> Toko (Webhook)
          </button>
          <button
            onClick={() => setActiveTab("whatsapp")}
            className={`flex items-center gap-2 py-2 px-3 text-xs font-bold rounded-xl transition ${activeTab === "whatsapp" ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <Server className="w-4 h-4" /> WhatsApp
          </button>
          <button
            onClick={() => setActiveTab("database")}
            className={`flex items-center gap-2 py-2 px-3 text-xs font-bold rounded-xl transition ${activeTab === "database" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <Database className="w-4 h-4" /> Database
          </button>
          <button
            onClick={() => setActiveTab("data")}
            className={`flex items-center gap-2 py-2 px-3 text-xs font-bold rounded-xl transition ${activeTab === "data" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <Download className="w-4 h-4" /> Backup Data
          </button>
        </div>
      </div>

      {/* Render Tab Content */}
      {activeTab === "business" && (
        <BusinessSettings
          business={props.business}
          onSaveBusiness={props.onSaveBusiness}
        />
      )}

      {activeTab === "store" && storeConfig && (
        <StoreSettings
          storeConfig={storeConfig}
          onSaveStoreApi={handleSaveStoreApi}
        />
      )}

      {activeTab === "whatsapp" && (
        <WhatsAppSettings
          config={props.config}
          onSaveConfig={props.onSaveConfig}
        />
      )}

      {activeTab === "database" && (
        <DatabaseSettings onRefreshData={props.onRefreshData} />
      )}

      {activeTab === "data" && (
        <BackupSettings
          invoices={props.invoices}
          business={props.business}
          config={props.config}
          storeConfig={storeConfig}
          onImportData={props.onImportData}
          onResetData={props.onResetData}
        />
      )}
    </div>
  );
};
