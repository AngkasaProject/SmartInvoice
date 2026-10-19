import React from 'react';
import { BusinessProfile } from '../types/invoice';
import {
  LayoutDashboard,
  FilePlus,
  History,
  Settings,
  Store,
  Plus,
} from 'lucide-react';

interface NavbarProps {
  currentView: 'dashboard' | 'create' | 'edit' | 'history' | 'settings';
  onChangeView: (view: 'dashboard' | 'create' | 'history' | 'settings') => void;
  business: BusinessProfile;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onChangeView,
  business,
}) => {
  return (
    <>
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand/Logo Section:
                If logo exists: display ONLY the logo image (NO "Kirim Invoice" text).
                If no logo: display Store / Business Name. */}
            <div
              onClick={() => onChangeView('dashboard')}
              className="flex items-center cursor-pointer select-none py-1 group max-w-[220px] sm:max-w-xs truncate"
              title="Kembali ke Dashboard"
            >
              {business.logoUrl ? (
                <img
                  src={business.logoUrl}
                  alt={business.businessName || 'Logo Toko'}
                  className="h-9 sm:h-10 max-h-10 w-auto max-w-[170px] sm:max-w-[210px] object-contain rounded-lg"
                />
              ) : (
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Store className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
                  </div>
                  <div className="truncate">
                    <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight block leading-tight truncate">
                      {business.businessName || 'Nama Toko Anda'}
                    </span>
                    {business.city && (
                      <span className="text-[10px] text-slate-400 font-medium block truncate">
                        {business.city}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Desktop & Tablet Navigation Tabs (hidden on small mobile, shown on md and above) */}
            <nav className="hidden md:flex items-center gap-1.5">
              <button
                onClick={() => onChangeView('dashboard')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  currentView === 'dashboard'
                    ? 'bg-indigo-50 text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => onChangeView('create')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  currentView === 'create' || currentView === 'edit'
                    ? 'bg-indigo-50 text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FilePlus className="w-4 h-4" />
                <span>Buat Invoice</span>
              </button>

              <button
                onClick={() => onChangeView('history')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  currentView === 'history'
                    ? 'bg-indigo-50 text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <History className="w-4 h-4" />
                <span>Riwayat</span>
              </button>

              <button
                onClick={() => onChangeView('settings')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  currentView === 'settings'
                    ? 'bg-indigo-50 text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Pengaturan</span>
              </button>
            </nav>

            {/* Quick "+ Invoice Baru" on top bar */}
            <div className="flex items-center">
              <button
                onClick={() => onChangeView('create')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 active:scale-95 transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-300" />
                <span className="hidden sm:inline">+ Invoice Baru</span>
                <span className="sm:hidden">+ Baru</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Ultra-responsive for Phones & Phablets) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-1.5 px-2 flex justify-around items-center shadow-lg safe-bottom">
        <button
          onClick={() => onChangeView('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
            currentView === 'dashboard'
              ? 'text-indigo-600 font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Dashboard</span>
        </button>

        <button
          onClick={() => onChangeView('create')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
            currentView === 'create' || currentView === 'edit'
              ? 'text-indigo-600 font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <FilePlus className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Buat</span>
        </button>

        <button
          onClick={() => onChangeView('history')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
            currentView === 'history'
              ? 'text-indigo-600 font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <History className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Riwayat</span>
        </button>

        <button
          onClick={() => onChangeView('settings')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
            currentView === 'settings'
              ? 'text-indigo-600 font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Settings className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Setting</span>
        </button>
      </div>
    </>
  );
};
