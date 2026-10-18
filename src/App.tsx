import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  Cloud,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Zap,
  DollarSign,
  Lock,
  Building2,
  FileText,
  Image as ImageIcon,
  Trash2,
  Edit,
  Eye,
  Settings,
  Shield,
  HelpCircle,
  TrendingUp,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  Bill,
  ApartmentUnit,
  DEFAULT_PROPERTY_ADDRESS,
  INITIAL_APARTMENT_UNITS,
  UnitInfo,
  INITIAL_UNIT_INFO,
  formatCurrency,
  formatReading,
  formatKwh,
  getAmountPaid,
  getRemainingBalance,
  getBillPaymentStatus,
  hasPaymentProofDetails,
  getAvailableMonths,
  getBillMonthKey,
} from './utils/billing';
import { CurrencyText } from './components/CurrencyText';
import {
  fetchAllFromCloud,
  saveBillToCloud,
  deleteBillFromCloud,
  saveUnitInfoToCloud,
  getCachedBills,
  setCachedBills,
  getCachedUnitInfo,
  setCachedUnitInfo,
  getLastSyncTime,
  setLastSyncTime,
  mergeCloudAndLocalBills,
  SyncState,
} from './services/cloudStorage';
import { InvoiceCard } from './components/InvoiceCard';
import { BillBuilderModal } from './components/BillBuilderModal';
import { PaymentModal } from './components/PaymentModal';
import { ReceiptLightbox } from './components/ReceiptLightbox';
import { CloudSyncModal } from './components/CloudSyncModal';
import { UnitManagerModal } from './components/UnitManagerModal';
import { PasscodeLockModal } from './components/PasscodeLockModal';
import { MonthlyReportsView } from './components/MonthlyReportsView';

export default function App() {
  // State for Bills & Unit Info (Starts with ZERO bills, only 5 initialized unit containers)
  const [bills, setBills] = useState<Bill[]>(() => getCachedBills());
  const [unitInfoMap, setUnitInfoMap] = useState<Record<ApartmentUnit, UnitInfo>>(() =>
    getCachedUnitInfo()
  );

  // Workspace view state ('statements' | 'reports')
  const [activeView, setActiveView] = useState<'statements' | 'reports'>('statements');
  const [selectedReportMonth, setSelectedReportMonth] = useState<string>(() => {
    const initialBills = getCachedBills();
    return getAvailableMonths(initialBills)[0];
  });

  // Filter & Search states
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<ApartmentUnit | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PARTIAL' | 'PAID'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Cloud Sync state
  const [syncState, setSyncState] = useState<SyncState>('syncing');
  const [lastSyncTime, setLastSyncTimeState] = useState<string | null>(() => getLastSyncTime());
  const isSavingRef = useRef<boolean>(false);

  // Security / PIN Lock state
  const [isPinEnabled, setIsPinEnabled] = useState<boolean>(() => {
    return localStorage.getItem('calibara_pin_enabled') === 'true';
  });
  const [savedPin, setSavedPin] = useState<string>(() => {
    return localStorage.getItem('calibara_pin_code') || '1234';
  });
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    return localStorage.getItem('calibara_pin_enabled') === 'true';
  });

  // Modals state
  const [isBillBuilderOpen, setIsBillBuilderOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [builderDefaultUnit, setBuilderDefaultUnit] = useState<ApartmentUnit>('UNIT S1');

  const [activeInvoiceModalBill, setActiveInvoiceModalBill] = useState<Bill | null>(null);
  const [activePaymentModalBill, setActivePaymentModalBill] = useState<Bill | null>(null);

  const [lightboxData, setLightboxData] = useState<{ url: string; title: string } | null>(null);
  const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState(false);
  const [isUnitManagerModalOpen, setIsUnitManagerModalOpen] = useState(false);
  const [isPinSettingsOpen, setIsPinSettingsOpen] = useState(false);
  const [syncToast, setSyncToast] = useState<{
    message: string;
    type: 'syncing' | 'synced' | 'offline';
  } | null>(null);

  const showSyncToast = (
    message: string,
    type: 'syncing' | 'synced' | 'offline' = 'synced',
    duration = 3200
  ) => {
    setSyncToast({ message, type });
    if (type !== 'syncing') {
      setTimeout(() => {
        setSyncToast((prev) => (prev?.message === message ? null : prev));
      }, duration);
    }
  };

  const handleCloudSync = async (silent = false) => {
    if (isSavingRef.current && silent) {
      return;
    }
    try {
      setSyncState('syncing');
      if (!silent) {
        showSyncToast('Syncing with Google Cloud...', 'syncing');
      }
      const cloudData = await fetchAllFromCloud();

      if (cloudData.bills) {
        const localCached = getCachedBills();
        const merged = mergeCloudAndLocalBills(localCached, cloudData.bills);
        setBills(merged);
        setCachedBills(merged);
      }
      if (cloudData.unitInfo) {
        const localUnits = getCachedUnitInfo();
        const mergedUnits = { ...localUnits, ...cloudData.unitInfo };
        setUnitInfoMap(mergedUnits);
        setCachedUnitInfo(mergedUnits);
      }

      const now = new Date().toISOString();
      setLastSyncTime(now);
      setLastSyncTimeState(now);
      setSyncState('synced');
      if (!silent) {
        showSyncToast('All changes synced with cloud!', 'synced');
      }
    } catch (err) {
      console.warn('Cloud sync fallback to local cache:', err);
      // Fallback to localStorage cache without losing local edits
      const cached = getCachedBills();
      setBills(cached);
      setSyncState('offline');
      if (!silent) {
        showSyncToast('Offline: saved to local cache', 'offline');
      }
    }
  };

  // Continuous background auto-sync:
  // 1. Initial load
  // 2. Tab focus / visibility change (so switching tabs auto-syncs)
  // 3. Online event listener
  // 4. Background polling every 25 seconds when tab is active
  useEffect(() => {
    handleCloudSync(true);

    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        handleCloudSync(true);
      }
    };

    const handleOnline = () => {
      handleCloudSync(false);
    };

    window.addEventListener('visibilitychange', handleFocusOrVisible);
    window.addEventListener('focus', handleFocusOrVisible);
    window.addEventListener('online', handleOnline);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        handleCloudSync(true);
      }
    }, 25000);

    return () => {
      window.removeEventListener('visibilitychange', handleFocusOrVisible);
      window.removeEventListener('focus', handleFocusOrVisible);
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, []);

  // Save bill handler - updates UI & local cache immediately, auto-syncs to cloud in background!
  const handleSaveBill = async (billToSave: Bill) => {
    isSavingRef.current = true;
    // 1. Update local state and cache immediately (instant UI responsiveness)
    const currentBills = getCachedBills();
    const baseBills = currentBills.length >= bills.length ? currentBills : bills;
    const existingIndex = baseBills.findIndex((b) => b.id === billToSave.id);
    let updatedBills: Bill[];
    if (existingIndex >= 0) {
      updatedBills = [...baseBills];
      updatedBills[existingIndex] = billToSave;
    } else {
      updatedBills = [billToSave, ...baseBills];
    }

    setBills(updatedBills);
    setCachedBills(updatedBills);
    setSelectedReportMonth(getBillMonthKey(billToSave));

    // If active invoice modal is open for this bill, update it
    if (activeInvoiceModalBill?.id === billToSave.id) {
      setActiveInvoiceModalBill(billToSave);
    }

    // 2. Auto-sync immediately to Google Apps Script cloud without blocking modal close
    (async () => {
      try {
        setSyncState('syncing');
        showSyncToast(`Auto-syncing bill for ${billToSave.unit}...`, 'syncing');
        await saveBillToCloud(billToSave);
        const now = new Date().toISOString();
        setLastSyncTime(now);
        setLastSyncTimeState(now);
        setSyncState('synced');
        showSyncToast(`Bill for ${billToSave.unit} auto-synced to cloud!`, 'synced');
      } catch (err) {
        console.warn('Cloud save deferred to local cache:', err);
        setSyncState('offline');
        showSyncToast('Saved to offline storage (will sync when online)', 'offline');
      } finally {
        isSavingRef.current = false;
      }
    })();
  };

  // Delete bill handler - auto-syncs immediately!
  const handleDeleteBill = async (billId: string, unitName: string) => {
    if (!confirm(`Are you sure you want to delete this bill for ${unitName}? This cannot be undone.`)) {
      return;
    }

    const updatedBills = bills.filter((b) => b.id !== billId);
    setBills(updatedBills);
    setCachedBills(updatedBills);

    if (activeInvoiceModalBill?.id === billId) {
      setActiveInvoiceModalBill(null);
    }
    if (activePaymentModalBill?.id === billId) {
      setActivePaymentModalBill(null);
    }

    try {
      setSyncState('syncing');
      showSyncToast(`Deleting and auto-syncing ${unitName}...`, 'syncing');
      await deleteBillFromCloud(billId);
      const now = new Date().toISOString();
      setLastSyncTime(now);
      setLastSyncTimeState(now);
      setSyncState('synced');
      showSyncToast(`Bill deleted and cloud synced!`, 'synced');
    } catch (err) {
      console.warn('Cloud delete error:', err);
      setSyncState('offline');
      showSyncToast('Deleted locally (cloud sync deferred)', 'offline');
    }
  };

  // Payment status handler - auto-syncs immediately!
  const handleSavePayment = async (updatedBill: Bill) => {
    await handleSaveBill(updatedBill);
    if (updatedBill.isPaid) {
      confetti({
        particleCount: 75,
        spread: 60,
        origin: { y: 0.6 },
      });
    }
  };

  // Unit info handler - auto-syncs immediately to cloud!
  const handleSaveUnitInfo = async (updatedInfo: Record<ApartmentUnit, UnitInfo>) => {
    setUnitInfoMap(updatedInfo);
    setCachedUnitInfo(updatedInfo);
    try {
      setSyncState('syncing');
      showSyncToast('Auto-syncing unit profiles to cloud...', 'syncing');
      await saveUnitInfoToCloud(updatedInfo);
      const now = new Date().toISOString();
      setLastSyncTime(now);
      setLastSyncTimeState(now);
      setSyncState('synced');
      showSyncToast('Unit profiles auto-synced to cloud!', 'synced');
    } catch (err) {
      console.warn('Cloud save deferred to local cache:', err);
      setSyncState('offline');
      showSyncToast('Saved to offline cache (will sync when online)', 'offline');
    }
  };

  // Security / PIN Settings handler
  const handleUpdatePinSettings = (enabled: boolean, newPin: string) => {
    setIsPinEnabled(enabled);
    setSavedPin(newPin);
    localStorage.setItem('calibara_pin_enabled', String(enabled));
    localStorage.setItem('calibara_pin_code', newPin);
    if (!enabled) {
      setIsLocked(false);
    }
  };

  // Filtered bills
  const filteredBills = useMemo(() => {
    return bills.filter((bill) => {
      // Unit filter
      if (selectedUnitFilter !== 'ALL' && bill.unit !== selectedUnitFilter) {
        return false;
      }
      // Status filter
      const bStatus = getBillPaymentStatus(bill);
      if (statusFilter === 'UNPAID' && bStatus === 'PAID') return false;
      if (statusFilter === 'PARTIAL' && bStatus !== 'PARTIAL') return false;
      if (statusFilter === 'PAID' && bStatus !== 'PAID') return false;
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesUnit = bill.unit.toLowerCase().includes(query);
        const matchesPeriod = bill.billingPeriod.toLowerCase().includes(query);
        const matchesRef = bill.paymentProof?.referenceNo?.toLowerCase().includes(query);
        const matchesNotes = bill.paymentProof?.notes?.toLowerCase().includes(query);
        const matchesTenant = unitInfoMap[bill.unit]?.tenantName.toLowerCase().includes(query);
        return matchesUnit || matchesPeriod || matchesRef || matchesNotes || matchesTenant;
      }
      return true;
    });
  }, [bills, selectedUnitFilter, statusFilter, searchQuery, unitInfoMap]);

  // Overall Statistics (Accurately handles Partial Payments & Remaining Balances)
  const stats = useMemo(() => {
    const totalBills = bills.length;
    const unpaidBills = bills.filter((b) => getBillPaymentStatus(b) !== 'PAID');
    const partialBills = bills.filter((b) => getBillPaymentStatus(b) === 'PARTIAL');
    const paidBills = bills.filter((b) => getBillPaymentStatus(b) === 'PAID');

    const totalUnpaidAmount = bills.reduce((acc, b) => acc + getRemainingBalance(b), 0);
    const totalPaidAmount = bills.reduce((acc, b) => acc + getAmountPaid(b), 0);
    const totalKwh = bills.reduce((acc, b) => acc + (b.consumptionKwh || 0), 0);

    return {
      totalBills,
      unpaidCount: unpaidBills.length,
      partialCount: partialBills.length,
      paidCount: paidBills.length,
      totalUnpaidAmount,
      totalPaidAmount,
      totalKwh,
    };
  }, [bills]);

  // Dynamic list of configured units
  const configuredUnits = useMemo(() => Object.keys(unitInfoMap), [unitInfoMap]);

  // Quick unit balances for all configured units
  const unitStats = useMemo(() => {
    const map: Record<string, { unpaidCount: number; unpaidSum: number }> = {};
    configuredUnits.forEach((u) => {
      map[u] = { unpaidCount: 0, unpaidSum: 0 };
    });

    bills.forEach((b) => {
      const rem = getRemainingBalance(b);
      if (rem > 0) {
        if (!map[b.unit]) {
          map[b.unit] = { unpaidCount: 0, unpaidSum: 0 };
        }
        map[b.unit].unpaidCount += 1;
        map[b.unit].unpaidSum += rem;
      }
    });

    return map;
  }, [bills, configuredUnits]);

  const openNewBillModal = (forUnit?: ApartmentUnit) => {
    setEditingBill(null);
    if (forUnit) {
      setBuilderDefaultUnit(forUnit);
    } else if (selectedUnitFilter !== 'ALL') {
      setBuilderDefaultUnit(selectedUnitFilter);
    } else {
      setBuilderDefaultUnit(configuredUnits[0] || 'UNIT S1');
    }
    setIsBillBuilderOpen(true);
  };

  const openEditBillModal = (bill: Bill) => {
    setEditingBill(bill);
    setBuilderDefaultUnit(bill.unit);
    setIsBillBuilderOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F4F2EC] text-[#2C332B] flex flex-col font-sans">
      {/* Optional Landlord Passcode Screen */}
      <PasscodeLockModal
        isLocked={isLocked}
        onUnlock={() => setIsLocked(false)}
        savedPin={savedPin}
        isPinEnabled={isPinEnabled}
        onUpdatePinSettings={handleUpdatePinSettings}
      />

      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-[#2C332B] text-white shadow-md border-b border-[#3D453C]">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3.5 flex items-center justify-between gap-2">
          {/* Brand */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-stone-800/90 border border-stone-600 flex items-center justify-center text-amber-200 shadow-xs shrink-0">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="font-serif-invoice text-base sm:text-xl font-bold tracking-[0.14em] uppercase text-white leading-none truncate">
                  CALIBARA APARTMENT
                </h1>
                <span className="hidden md:inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-300/30">
                  Landlord Cloud
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-stone-300 tracking-wider uppercase mt-0.5 font-medium truncate">
                Batas, Silang, Cavite • Submeter & Payment Tracker
              </p>
            </div>
          </div>

          {/* Cloud Sync Status & Actions */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Live Cloud Status Button */}
            <button
              onClick={() => setIsCloudSyncModalOpen(true)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold bg-stone-800/90 hover:bg-stone-700/90 border border-stone-700 transition-colors shadow-2xs cursor-pointer"
              title="Cloud Sync Settings"
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  syncState === 'synced'
                    ? 'bg-emerald-400'
                    : syncState === 'syncing'
                    ? 'bg-amber-400 animate-spin'
                    : 'bg-stone-400'
                }`}
              />
              <span className="hidden md:inline text-[11px] text-stone-200">
                {syncState === 'synced' && 'Auto-Sync Active'}
                {syncState === 'syncing' && 'Auto-Syncing...'}
                {syncState === 'offline' && 'Offline Cache'}
                {syncState === 'error' && 'Sync Error'}
              </span>
              <Cloud className="w-3.5 h-3.5 text-stone-300" />
            </button>

            {/* Quick Sync Now Refresh button */}
            <button
              onClick={handleCloudSync}
              disabled={syncState === 'syncing'}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium bg-stone-800/90 hover:bg-stone-700/90 border border-stone-700 text-stone-200 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
              title="Sync now with Google Sheets cloud"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
              <span className="hidden lg:inline">Sync Now</span>
            </button>

            {/* Unit Info modal button */}
            <button
              onClick={() => setIsUnitManagerModalOpen(true)}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium bg-stone-800/90 hover:bg-stone-700/90 border border-stone-700 text-stone-200 transition-colors cursor-pointer flex items-center gap-1"
              title="Manage Apartment Units and Tenant Info"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Units ({configuredUnits.length})</span>
            </button>

            {/* Security Lock Toggle / Settings */}
            {isPinEnabled ? (
              <button
                onClick={() => setIsLocked(true)}
                className="p-1.5 sm:px-2 sm:py-1.5 rounded-lg text-xs font-medium bg-stone-800/90 hover:bg-stone-700/90 border border-stone-700 text-amber-200 transition-colors cursor-pointer flex items-center gap-1"
                title="Lock Application Now"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => setIsPinSettingsOpen(true)}
                className="p-1.5 sm:px-2 sm:py-1.5 rounded-lg text-xs font-medium bg-stone-800/90 hover:bg-stone-700/90 border border-stone-700 text-stone-300 transition-colors cursor-pointer flex items-center gap-1"
                title="Passcode Settings"
              >
                <Shield className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Create New Bill CTA Button */}
            <button
              onClick={() => openNewBillModal()}
              className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-400 text-stone-950 hover:bg-amber-300 transition-all shadow-sm active:scale-95 cursor-pointer ml-0.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Bill</span>
              <span className="sm:hidden">Bill</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-5 flex flex-col gap-5">
        {/* Workspace View Switcher Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 sm:px-4 sm:py-3 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl self-start">
            <button
              type="button"
              onClick={() => setActiveView('statements')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeView === 'statements'
                  ? 'bg-[#2C332B] text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Billing Statements ({bills.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (bills.length > 0 && !bills.some((b) => getBillMonthKey(b) === selectedReportMonth) && selectedReportMonth !== 'ALL') {
                  setSelectedReportMonth(getAvailableMonths(bills)[0]);
                }
                setActiveView('reports');
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeView === 'reports'
                  ? 'bg-[#2C332B] text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Monthly Reports</span>
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-stone-500">
            <span className="hidden md:inline">
              {activeView === 'statements'
                ? 'Manage tenant statements, submeter readings, and payment proofs'
                : 'Track monthly electricity consumption and payment collection rate trends'}
            </span>
          </div>
        </div>

        {activeView === 'reports' ? (
          <MonthlyReportsView
            bills={bills}
            unitInfoMap={unitInfoMap}
            selectedMonth={selectedReportMonth}
            onSelectMonth={setSelectedReportMonth}
            onOpenNewBill={(unit) => openNewBillModal(unit)}
            onViewInvoice={(bill) => setActiveInvoiceModalBill(bill)}
            onRecordPayment={(bill) => setActivePaymentModalBill(bill)}
            onViewProof={(url, title) => setLightboxData({ url, title })}
          />
        ) : (
          <>
            {/* Statistics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Unpaid Card */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-stone-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-500 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Unpaid Balance</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-lg sm:text-2xl font-bold font-sans text-amber-700">
              <CurrencyText amount={stats.totalUnpaidAmount} />
            </p>
            <p className="text-[11px] text-stone-500 mt-1">
              {stats.unpaidCount} {stats.unpaidCount === 1 ? 'bill' : 'bills'} awaiting payment
            </p>
          </div>

          {/* Paid Collected Card */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-stone-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-500 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Total Collected</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-lg sm:text-2xl font-bold font-sans text-emerald-700">
              <CurrencyText amount={stats.totalPaidAmount} />
            </p>
            <p className="text-[11px] text-stone-500 mt-1">
              {stats.paidCount} paid in full
              {stats.partialCount > 0 ? ` • ${stats.partialCount} partial` : ''}
            </p>
          </div>

          {/* Electricity kWh Card */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-stone-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-500 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Electricity Usage</span>
              <Zap className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-lg sm:text-2xl font-bold font-sans text-stone-800">
              {stats.totalKwh.toFixed(1)} <span className="text-xs font-medium text-stone-500">kWh</span>
            </p>
            <p className="text-[11px] text-stone-500 mt-1">Total recorded submeter usage</p>
          </div>

          {/* Units Capacity Card */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-stone-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-500 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Apartment Units</span>
              <Building2 className="w-4 h-4 text-stone-700" />
            </div>
            <p className="text-lg sm:text-2xl font-bold font-serif text-[#2C332B]">
              {configuredUnits.length} {configuredUnits.length === 1 ? 'Unit' : 'Units'}
            </p>
            <div className="flex items-center gap-1 text-[10px] font-mono text-stone-500 mt-1 truncate">
              <span>{configuredUnits.map((u) => u.replace(/^UNIT\s+/i, '')).join(' • ')}</span>
            </div>
          </div>
        </div>

        {/* 1. Unit Filter Bar (Section 3 Requirement) */}
        <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-stone-200 shadow-2xs flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-stone-500" />
              Filter by Unit
            </span>
            <span className="text-[11px] text-stone-400">
              Showing: {selectedUnitFilter === 'ALL' ? 'All Units' : selectedUnitFilter}
            </span>
          </div>

          {/* Horizontal scrollable unit chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedUnitFilter('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedUnitFilter === 'ALL'
                  ? 'bg-[#2C332B] text-white shadow-xs'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <span>ALL UNITS</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20">
                {bills.length}
              </span>
            </button>

            {configuredUnits.map((u) => {
              const uStat = unitStats[u] || { unpaidCount: 0, unpaidSum: 0 };
              const isSelected = selectedUnitFilter === u;
              const tenant = unitInfoMap[u]?.tenantName;
              return (
                <button
                  key={u}
                  onClick={() => setSelectedUnitFilter(u)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 border ${
                    isSelected
                      ? 'bg-[#2C332B] text-white border-[#2C332B] shadow-xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <div className="flex flex-col text-left">
                    <span className="leading-tight">{u}</span>
                    {tenant && (
                      <span className={`text-[9px] font-normal truncate max-w-[80px] ${isSelected ? 'text-amber-200' : 'text-stone-400'}`}>
                        {tenant}
                      </span>
                    )}
                  </div>

                  {uStat.unpaidCount > 0 && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-amber-400 text-stone-900'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                      title={`${uStat.unpaidCount} unpaid bill: ${formatCurrency(uStat.unpaidSum)}`}
                    >
                      {uStat.unpaidCount} unpaid
                    </span>
                  )}
                </button>
              );
            })}

            <button
              onClick={() => setIsUnitManagerModalOpen(true)}
              className="px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 bg-stone-100 hover:bg-stone-200 text-stone-600 border border-dashed border-stone-300"
              title="Add more units or manage property addresses"
            >
              <Plus className="w-3.5 h-3.5 text-stone-500" />
              <span>Add Unit</span>
            </button>
          </div>
        </div>

        {/* Search & Status Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by period, tenant, notes, ref #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-stone-200 text-xs font-medium placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#2C332B] shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter Tabs (ALL / UNPAID / PARTIAL / PAID) */}
          <div className="flex flex-wrap items-center gap-1 bg-stone-200/80 p-1 rounded-xl text-xs font-bold self-start sm:self-auto">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              All ({bills.length})
            </button>
            <button
              onClick={() => setStatusFilter('UNPAID')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'UNPAID'
                  ? 'bg-rose-100 text-rose-900 shadow-2xs'
                  : 'text-stone-600 hover:text-rose-900'
              }`}
            >
              <Clock className="w-3 h-3 text-rose-600" />
              Unpaid ({stats.unpaidCount})
            </button>
            <button
              onClick={() => setStatusFilter('PARTIAL')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'PARTIAL'
                  ? 'bg-amber-100 text-amber-900 shadow-2xs'
                  : 'text-stone-600 hover:text-amber-900'
              }`}
            >
              <AlertCircle className="w-3 h-3 text-amber-600" />
              Partial ({stats.partialCount})
            </button>
            <button
              onClick={() => setStatusFilter('PAID')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'PAID'
                  ? 'bg-emerald-100 text-emerald-900 shadow-2xs'
                  : 'text-stone-600 hover:text-emerald-900'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Paid ({stats.paidCount})
            </button>
          </div>
        </div>

        {/* Bills List / Grid */}
        {filteredBills.length === 0 ? (
          /* Empty State as requested (Zero initial pre-populated dummy bills) */
          <div className="bg-white rounded-2xl border border-stone-200 p-8 sm:p-12 text-center shadow-2xs flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-stone-100 text-[#2C332B] flex items-center justify-center mb-4 border border-stone-200">
              <Building2 className="w-8 h-8" />
            </div>

            <h3 className="font-serif-invoice text-xl sm:text-2xl font-bold uppercase tracking-wider text-[#2C332B]">
              {bills.length === 0
                ? 'Ready for Landlord Billing'
                : 'No Bills Match Your Current Filter'}
            </h3>

            <p className="text-xs sm:text-sm text-stone-500 max-w-md mt-1.5 mb-6">
              {bills.length === 0
                ? 'All 5 apartment containers (UNIT A1, B, C, S1, S2) are initialized with empty billing history. Create your first tenant billing statement below.'
                : 'Try clearing your search query or switching unit filters to view other apartment statements.'}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() =>
                  openNewBillModal(
                    selectedUnitFilter !== 'ALL' ? selectedUnitFilter : 'UNIT S1'
                  )
                }
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#2C332B] text-white hover:bg-[#1E231D] transition-colors shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>
                  Create Bill for{' '}
                  {selectedUnitFilter !== 'ALL' ? selectedUnitFilter : 'Unit S1'}
                </span>
              </button>

              <button
                onClick={() => setIsUnitManagerModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-stone-100 text-stone-700 hover:bg-stone-200 transition-colors border border-stone-200 cursor-pointer"
              >
                <Building2 className="w-4 h-4" />
                <span>Configure Tenant Profiles</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBills.map((bill) => {
              const tenant = unitInfoMap[bill.unit]?.tenantName;
              const bStatus = getBillPaymentStatus(bill);
              const amountPaid = getAmountPaid(bill);
              const remainingBalance = getRemainingBalance(bill);
              const hasProof = hasPaymentProofDetails(bill);

              return (
                <div
                  key={bill.id}
                  className="bg-white rounded-2xl border border-stone-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
                >
                  {/* Top Bar of Bill Card */}
                  <div className="p-4 border-b border-stone-100 flex items-start justify-between bg-stone-50/60">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm bg-[#2C332B] text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          {bill.unit}
                        </span>
                        {tenant && (
                          <span className="text-xs text-stone-600 font-semibold truncate max-w-[140px]">
                            {tenant}
                          </span>
                        )}
                      </div>
                      <h4 className="font-serif-invoice text-base font-bold text-stone-900 mt-1.5 leading-snug">
                        {bill.billingPeriod}
                      </h4>
                      <p className="text-[11px] text-stone-500 font-medium">
                        Date: {bill.billingDate || bill.createdAt.slice(0, 10)}
                      </p>
                    </div>

                    {/* Paid / Partial / Unpaid Status Badge */}
                    <div className="flex flex-col items-end">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide flex items-center gap-1 ${
                          bStatus === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : bStatus === 'PARTIAL'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {bStatus === 'PAID' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>PAID IN FULL</span>
                          </>
                        ) : bStatus === 'PARTIAL' ? (
                          <>
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>PARTIAL</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5" />
                            <span>UNPAID</span>
                          </>
                        )}
                      </span>
                      {bStatus !== 'UNPAID' && bill.paymentProof?.paymentMethod && (
                        <span className="text-[10px] text-stone-500 font-medium mt-1">
                          via {bill.paymentProof.paymentMethod}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body: Breakdown */}
                  <div className="p-4 flex flex-col gap-2.5 text-xs">
                    {/* Electricity submeter row */}
                    <div className="bg-[#EFECE6]/70 p-2.5 rounded-xl border border-[#DFDDD4] flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-stone-500 uppercase block">
                          Submeter ({formatReading(bill.lastReading)} → {formatReading(bill.currentReading)})
                        </span>
                        <span className="font-bold text-stone-800">
                          {formatKwh(bill.consumptionKwh)} @ <CurrencyText amount={bill.ratePerKwh} />
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-medium text-stone-500 uppercase block">
                          Electricity
                        </span>
                        <span className="font-bold text-stone-900">
                          <CurrencyText amount={bill.electricityTotal} />
                        </span>
                      </div>
                    </div>

                    {/* Rent items row */}
                    {bill.rentItems && bill.rentItems.length > 0 && (
                      <div className="flex flex-col gap-1 px-1">
                        {bill.rentItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex justify-between items-center text-stone-600 text-[11px]"
                          >
                            <span>{item.description}:</span>
                            <span className="font-semibold text-stone-800">
                              <CurrencyText amount={item.amount} />
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Total Amount Due */}
                    <div className="flex justify-between items-center pt-2 border-t border-stone-200">
                      <span className="font-bold text-xs uppercase tracking-wider text-stone-700">
                        TOTAL AMOUNT DUE:
                      </span>
                      <span className="font-serif-invoice text-lg font-extrabold text-[#2C332B]">
                        <CurrencyText amount={bill.totalAmountDue} roundUp noDecimals />
                      </span>
                    </div>

                    {/* Partial Payment / Paid Amount Summary Box */}
                    {(bStatus === 'PARTIAL' || amountPaid > 0) && (
                      <div
                        className={`p-2.5 rounded-xl border flex flex-col gap-1 ${
                          bStatus === 'PARTIAL'
                            ? 'bg-amber-50/90 border-amber-200'
                            : 'bg-emerald-50/70 border-emerald-200'
                        }`}
                      >
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-bold text-stone-700">Amount Paid:</span>
                          <span className="font-extrabold text-emerald-700">
                            <CurrencyText amount={amountPaid} />
                          </span>
                        </div>
                        {bStatus === 'PARTIAL' && (
                          <div className="flex justify-between items-center text-[11px] pt-1 border-t border-amber-200/80">
                            <span className="font-bold text-rose-800 uppercase">
                              Remaining Balance:
                            </span>
                            <span className="font-extrabold text-rose-700 text-xs">
                              <CurrencyText amount={remainingBalance} />
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Attached Proof of Payment Preview & Details */}
                    {hasProof && (
                      <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-xl flex flex-col gap-2">
                        {bill.paymentProof?.dataUrl ? (
                          <div
                            onClick={() =>
                              setLightboxData({
                                url: bill.paymentProof!.dataUrl!,
                                title: `${bill.unit} - ${bill.billingPeriod} Payment Receipt`,
                              })
                            }
                            className="flex items-center gap-2.5 cursor-pointer group"
                          >
                            <img
                              src={bill.paymentProof.dataUrl}
                              alt="Proof of payment receipt"
                              className="w-12 h-12 object-cover rounded-lg border border-emerald-300 shadow-2xs shrink-0 group-hover:scale-105 transition-transform"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-bold text-emerald-900 truncate flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>Proof of Payment Attached</span>
                              </p>
                              <p className="text-[10px] text-stone-600 truncate">
                                {bill.paymentProof.datePaid || 'Recorded'} •{' '}
                                {bill.paymentProof.paymentMethod || 'Payment'}
                                {bill.paymentProof.referenceNo
                                  ? ` • Ref: ${bill.paymentProof.referenceNo}`
                                  : ''}
                              </p>
                              {bill.paymentProof.notes && (
                                <p className="text-[10px] text-stone-500 italic truncate">
                                  "{bill.paymentProof.notes}"
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxData({
                                  url: bill.paymentProof!.dataUrl!,
                                  title: `${bill.unit} - ${bill.billingPeriod} Payment Receipt`,
                                });
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-[#2C332B] text-white text-[10px] font-bold flex items-center gap-1 hover:bg-[#1E231D] shrink-0 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View Proof</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold text-stone-700 truncate">
                                {bill.paymentProof?.datePaid || 'Recorded'} •{' '}
                                {bill.paymentProof?.paymentMethod || 'Payment'}
                                {bill.paymentProof?.referenceNo
                                  ? ` • Ref: ${bill.paymentProof.referenceNo}`
                                  : ''}
                              </p>
                              {bill.paymentProof?.notes && (
                                <p className="text-[10px] text-stone-500 italic truncate">
                                  "{bill.paymentProof.notes}"
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setActivePaymentModalBill(bill)}
                              className="px-2 py-1 rounded-md bg-stone-200 hover:bg-stone-300 text-stone-800 text-[10px] font-bold shrink-0 cursor-pointer"
                            >
                              + Receipt Photo
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-1">
                    {/* View Invoice Card (Exact Reference Photo) */}
                    <button
                      onClick={() => setActiveInvoiceModalBill(bill)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#2C332B] text-white hover:bg-[#1E231D] transition-colors shadow-2xs cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Invoice</span>
                    </button>

                    {/* Record Payment / Partial / Payment Proof */}
                    <button
                      onClick={() => setActivePaymentModalBill(bill)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                        bStatus === 'PAID'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          : bStatus === 'PARTIAL'
                          ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                          : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {bStatus === 'PAID'
                          ? 'Payment / Proof'
                          : bStatus === 'PARTIAL'
                          ? 'Update Payment'
                          : 'Record Payment'}
                      </span>
                    </button>

                    <div className="flex items-center gap-1">
                      {/* Edit Bill */}
                      <button
                        onClick={() => openEditBillModal(bill)}
                        className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
                        title="Edit Bill Details"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Bill */}
                      <button
                        onClick={() => handleDeleteBill(bill.id, bill.unit)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Bill"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-8 border-t border-stone-300 bg-white/70 py-4 px-4 text-center text-xs text-stone-500">
        <p className="font-serif-invoice text-sm font-semibold tracking-wider uppercase text-[#2C332B]">
          Calibara Apartment Landlord Portal
        </p>
        <p className="text-[11px] text-stone-400 mt-0.5">
          Designed for Mobile & Computer • Real-time Google Apps Script REST API Sync • Batas, Silang, Cavite
        </p>
      </footer>

      {/* MODAL 1: Bill Builder (Create / Edit) */}
      {isBillBuilderOpen && (
        <BillBuilderModal
          isOpen={isBillBuilderOpen}
          onClose={() => setIsBillBuilderOpen(false)}
          onSaveBill={handleSaveBill}
          existingBills={bills}
          unitInfoMap={unitInfoMap}
          initialBill={editingBill}
          defaultUnit={builderDefaultUnit}
          onOpenUnitManager={() => setIsUnitManagerModalOpen(true)}
        />
      )}

      {/* MODAL 2: Full Invoice View & PNG Export (Matching Reference Photo) */}
      {activeInvoiceModalBill && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#2C332B] text-white">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-200" />
                <h3 className="font-semibold text-sm sm:text-base">
                  Tenant Billing Statement ({activeInvoiceModalBill.unit})
                </h3>
              </div>
              <button
                onClick={() => setActiveInvoiceModalBill(null)}
                className="p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-stone-700/50 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 sm:p-6 flex flex-col items-center bg-stone-100">
              <InvoiceCard
                bill={activeInvoiceModalBill}
                unitAddress={
                  activeInvoiceModalBill.propertyAddress ||
                  unitInfoMap[activeInvoiceModalBill.unit]?.address ||
                  DEFAULT_PROPERTY_ADDRESS
                }
                onMarkAsPaid={() => {
                  setActivePaymentModalBill(activeInvoiceModalBill);
                  setActiveInvoiceModalBill(null);
                }}
                onViewReceiptFull={(url, title) => setLightboxData({ url, title })}
              />
            </div>

            <div className="p-3 bg-stone-200/60 border-t border-stone-300 flex justify-between items-center text-xs">
              <span className="text-stone-500 text-[11px]">
                Tip: Tap "Save PNG (2x)" to download or "Share" to send via Messenger.
              </span>
              <button
                onClick={() => setActiveInvoiceModalBill(null)}
                className="px-4 py-1.5 bg-[#2C332B] text-white rounded-lg font-bold hover:bg-[#1E231D] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Mark as Paid & Payment Proof Upload */}
      {activePaymentModalBill && (
        <PaymentModal
          isOpen={Boolean(activePaymentModalBill)}
          onClose={() => setActivePaymentModalBill(null)}
          bill={activePaymentModalBill}
          onSavePayment={handleSavePayment}
          onViewReceiptFull={(url, title) => setLightboxData({ url, title })}
        />
      )}

      {/* MODAL 4: Fullscreen Payment Receipt Lightbox */}
      {lightboxData && (
        <ReceiptLightbox
          isOpen={Boolean(lightboxData)}
          imageUrl={lightboxData.url}
          title={lightboxData.title}
          onClose={() => setLightboxData(null)}
        />
      )}

      {/* MODAL 5: Cloud Sync Settings & Google Apps Script Setup */}
      {isCloudSyncModalOpen && (
        <CloudSyncModal
          isOpen={isCloudSyncModalOpen}
          onClose={() => setIsCloudSyncModalOpen(false)}
          syncState={syncState}
          lastSyncTime={lastSyncTime}
          onTriggerSync={handleCloudSync}
          bills={bills}
          unitInfoMap={unitInfoMap}
          onImportBackup={(importedBills, importedUnits) => {
            setBills(importedBills);
            setCachedBills(importedBills);
            if (importedUnits) {
              setUnitInfoMap(importedUnits);
              setCachedUnitInfo(importedUnits);
            }
          }}
        />
      )}

      {/* MODAL 6: Unit Manager (Occupants, default rent, notes) */}
      {isUnitManagerModalOpen && (
        <UnitManagerModal
          isOpen={isUnitManagerModalOpen}
          onClose={() => setIsUnitManagerModalOpen(false)}
          unitInfoMap={unitInfoMap}
          onSaveUnitInfo={handleSaveUnitInfo}
        />
      )}

      {/* MODAL 7: Passcode Settings */}
      {isPinSettingsOpen && (
        <PasscodeLockModal
          isLocked={false}
          onUnlock={() => {}}
          savedPin={savedPin}
          isPinEnabled={isPinEnabled}
          onUpdatePinSettings={handleUpdatePinSettings}
          isOpenSettingsOnly={true}
          onCloseSettings={() => setIsPinSettingsOpen(false)}
        />
      )}

      {/* Real-time Auto-Sync Floating Status Toast */}
      {syncToast && (
        <div
          className={`fixed bottom-4 right-4 z-50 flex items-center gap-2.5 px-3.5 py-2 rounded-xl shadow-lg border text-xs font-semibold backdrop-blur-md transition-all ${
            syncToast.type === 'syncing'
              ? 'bg-[#2C332B]/95 text-amber-200 border-amber-300/30'
              : syncToast.type === 'synced'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/30'
              : 'bg-stone-900/90 text-stone-200 border-stone-600'
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full ${
              syncToast.type === 'syncing'
                ? 'bg-amber-400 animate-spin'
                : syncToast.type === 'synced'
                ? 'bg-emerald-400'
                : 'bg-stone-400'
            }`}
          />
          <RefreshCw
            className={`w-3.5 h-3.5 ${
              syncToast.type === 'syncing' ? 'animate-spin text-amber-300' : 'text-emerald-400'
            }`}
          />
          <span>{syncToast.message}</span>
        </div>
      )}
    </div>
  );
}
