import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Zap, Eye, Calculator, MapPin, Building } from 'lucide-react';
import {
  Bill,
  ApartmentUnit,
  RentChargeItem,
  UnitInfo,
  DEFAULT_PROPERTY_ADDRESS,
  calculateConsumption,
  calculateElectricityTotal,
  calculateTotalDue,
  formatCurrency,
  getPreviousReadingForUnit,
} from '../utils/billing';
import { CurrencyText, PesoSymbol } from './CurrencyText';
import { InvoiceCard } from './InvoiceCard';

interface BillBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveBill: (bill: Bill) => Promise<void>;
  existingBills: Bill[];
  unitInfoMap: Record<ApartmentUnit, UnitInfo>;
  initialBill?: Bill | null;
  defaultUnit?: ApartmentUnit;
  onOpenUnitManager?: () => void;
}

export const BillBuilderModal: React.FC<BillBuilderModalProps> = ({
  isOpen,
  onClose,
  onSaveBill,
  existingBills,
  unitInfoMap,
  initialBill,
  defaultUnit = 'UNIT S1',
  onOpenUnitManager,
}) => {
  const availableUnits = Object.keys(unitInfoMap);
  const effectiveDefaultUnit = availableUnits.includes(defaultUnit)
    ? defaultUnit
    : availableUnits[0] || 'UNIT S1';

  const [unit, setUnit] = useState<ApartmentUnit>(effectiveDefaultUnit);
  const [propertyAddress, setPropertyAddress] = useState<string>(
    initialBill?.propertyAddress ||
      unitInfoMap[effectiveDefaultUnit]?.address ||
      DEFAULT_PROPERTY_ADDRESS
  );
  const [billingPeriod, setBillingPeriod] = useState('Current Billing Period October');
  const [billingDate, setBillingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lastReading, setLastReading] = useState<number>(0);
  const [currentReading, setCurrentReading] = useState<number>(0);
  const [ratePerKwh, setRatePerKwh] = useState<number>(15.0);
  const [rentItems, setRentItems] = useState<RentChargeItem[]>([
    { id: 'rent-1', description: 'Rent October', amount: 5000 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoFilledNotice, setAutoFilledNotice] = useState<string | null>(null);
  const [activeTabMobile, setActiveTabMobile] = useState<'form' | 'preview'>('form');

  // Load initial bill if editing
  useEffect(() => {
    if (initialBill) {
      setUnit(initialBill.unit);
      setPropertyAddress(
        initialBill.propertyAddress ||
          unitInfoMap[initialBill.unit]?.address ||
          DEFAULT_PROPERTY_ADDRESS
      );
      setBillingPeriod(initialBill.billingPeriod);
      setBillingDate(initialBill.billingDate || new Date().toISOString().slice(0, 10));
      setLastReading(initialBill.lastReading);
      setCurrentReading(initialBill.currentReading);
      setRatePerKwh(initialBill.ratePerKwh);
      setRentItems(initialBill.rentItems || []);
    } else {
      // New bill defaults
      const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
      const targetUnit = availableUnits.includes(defaultUnit) ? defaultUnit : availableUnits[0] || 'UNIT S1';
      setUnit(targetUnit);
      setPropertyAddress(unitInfoMap[targetUnit]?.address || DEFAULT_PROPERTY_ADDRESS);
      setBillingPeriod(`Current Billing Period ${currentMonth}`);
      setBillingDate(new Date().toISOString().slice(0, 10));

      const defaultRent = unitInfoMap[targetUnit]?.defaultMonthlyRent || 5000;
      setRentItems([{ id: `rent-${Date.now()}`, description: `Rent ${currentMonth}`, amount: defaultRent }]);

      // Check if previous reading exists
      const prevReading = getPreviousReadingForUnit(existingBills, targetUnit);
      if (prevReading !== null) {
        setLastReading(prevReading);
        setCurrentReading(prevReading);
      } else {
        setLastReading(0);
        setCurrentReading(0);
      }
    }
  }, [initialBill, defaultUnit, isOpen]);

  // When unit changes for new bill, auto update rent, address, and last reading
  const handleUnitChange = (newUnit: ApartmentUnit) => {
    setUnit(newUnit);
    setPropertyAddress(unitInfoMap[newUnit]?.address || DEFAULT_PROPERTY_ADDRESS);

    if (!initialBill) {
      const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
      const defaultRent = unitInfoMap[newUnit]?.defaultMonthlyRent || 4500;
      setRentItems([{ id: `rent-${Date.now()}`, description: `Rent ${currentMonth}`, amount: defaultRent }]);

      const prev = getPreviousReadingForUnit(existingBills, newUnit);
      if (prev !== null) {
        setLastReading(prev);
        setCurrentReading(prev);
        setAutoFilledNotice(`Auto-populated last reading (${prev.toFixed(1)}) from previous bill for ${newUnit}`);
        setTimeout(() => setAutoFilledNotice(null), 4000);
      }
    }
  };

  const handleAutoFillPreviousReading = () => {
    const prev = getPreviousReadingForUnit(existingBills, unit);
    if (prev !== null) {
      setLastReading(prev);
      if (currentReading < prev) {
        setCurrentReading(prev);
      }
      setAutoFilledNotice(`Found previous reading of ${prev.toFixed(1)} kWh for ${unit}!`);
      setTimeout(() => setAutoFilledNotice(null), 4000);
    } else {
      setAutoFilledNotice(`No previous bills recorded for ${unit}. Start from 0.0 or enter manually.`);
      setTimeout(() => setAutoFilledNotice(null), 4000);
    }
  };

  const handleAddRentRow = () => {
    setRentItems([
      ...rentItems,
      { id: `item-${Date.now()}`, description: 'Additional Charge', amount: 0 },
    ]);
  };

  const handleRemoveRentRow = (id: string) => {
    setRentItems(rentItems.filter((item) => item.id !== id));
  };

  const handleRentItemChange = (id: string, field: 'description' | 'amount', value: any) => {
    setRentItems(
      rentItems.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            [field]: field === 'amount' ? Math.max(0, parseFloat(value) || 0) : value,
          };
        }
        return item;
      })
    );
  };

  // Computations
  const consumptionKwh = calculateConsumption(currentReading, lastReading);
  const electricityTotal = calculateElectricityTotal(consumptionKwh, ratePerKwh);
  const totalAmountDue = calculateTotalDue(electricityTotal, rentItems);

  // Constructed bill object for live preview and saving
  const previewBill: Bill = {
    id: initialBill?.id || `bill-${Date.now()}`,
    unit,
    propertyAddress: propertyAddress.trim() || unitInfoMap[unit]?.address || DEFAULT_PROPERTY_ADDRESS,
    billingPeriod,
    billingDate,
    lastReading,
    currentReading,
    consumptionKwh,
    ratePerKwh,
    electricityTotal,
    rentItems,
    totalAmountDue,
    isPaid: initialBill?.isPaid || false,
    paymentStatus: initialBill?.paymentStatus,
    paymentProof: initialBill?.paymentProof,
    createdAt: initialBill?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentReading < lastReading) {
      if (!confirm('Current reading is lower than last reading. Are you sure you want to save?')) {
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await onSaveBill(previewBill);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to save bill. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="relative bg-[#FAF8F5] rounded-2xl w-full max-w-5xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#2C332B] text-white">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-amber-200" />
            <h3 className="font-semibold text-base sm:text-lg">
              {initialBill ? `Edit Invoice - ${initialBill.unit}` : 'Create New Tenant Invoice'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-stone-700/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Tabs Switcher */}
        <div className="md:hidden flex border-b border-stone-200 bg-white">
          <button
            onClick={() => setActiveTabMobile('form')}
            className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors ${
              activeTabMobile === 'form'
                ? 'border-[#2C332B] text-[#2C332B] bg-stone-50'
                : 'border-transparent text-stone-500'
            }`}
          >
            1. Bill Details & Readings
          </button>
          <button
            onClick={() => setActiveTabMobile('preview')}
            className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              activeTabMobile === 'preview'
                ? 'border-[#2C332B] text-[#2C332B] bg-stone-50'
                : 'border-transparent text-stone-500'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            2. Live Invoice Preview
          </button>
        </div>

        {/* Body Container */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Column: Form Controls */}
          <form
            onSubmit={handleSubmit}
            className={`md:col-span-6 flex flex-col gap-4 ${
              activeTabMobile === 'preview' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Unit Selector */}
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                  Select Apartment Unit
                </label>
                {onOpenUnitManager && (
                  <button
                    type="button"
                    onClick={onOpenUnitManager}
                    className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add / Manage Units</span>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {availableUnits.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => handleUnitChange(u)}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                      unit === u
                        ? 'bg-[#2C332B] text-white border-[#2C332B] shadow-xs'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>

              {/* Property Address on Invoice for this unit */}
              <div className="mt-3 pt-3 border-t border-stone-100">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-stone-400" />
                    <span>Property Address on Invoice</span>
                  </label>
                  {propertyAddress !== DEFAULT_PROPERTY_ADDRESS && (
                    <button
                      type="button"
                      onClick={() => setPropertyAddress(DEFAULT_PROPERTY_ADDRESS)}
                      className="text-[10px] text-emerald-700 hover:underline cursor-pointer"
                    >
                      Reset to Default
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value.toUpperCase())}
                  placeholder="e.g. BATAS, SILANG, CAVITE or TAGAYTAY CITY"
                  className="w-full text-xs font-medium p-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-[#2C332B] bg-stone-50 uppercase"
                />
              </div>

              {unitInfoMap[unit]?.tenantName && (
                <p className="text-[11px] text-stone-500 mt-2 font-medium">
                  Tenant: <span className="font-semibold text-stone-800">{unitInfoMap[unit].tenantName}</span>
                </p>
              )}
            </div>

            {/* Billing Period & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Billing Period Label
                </label>
                <input
                  type="text"
                  value={billingPeriod}
                  onChange={(e) => setBillingPeriod(e.target.value)}
                  placeholder="e.g. Current Billing Period October"
                  required
                  className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#2C332B] bg-stone-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Invoice Date
                </label>
                <input
                  type="date"
                  value={billingDate}
                  onChange={(e) => setBillingDate(e.target.value)}
                  required
                  className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#2C332B] bg-stone-50"
                />
              </div>
            </div>

            {/* Electricity Submeter Section */}
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider">
                  Electricity Submeter Readings
                </label>
                <button
                  type="button"
                  onClick={handleAutoFillPreviousReading}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-md border border-amber-200 transition-colors cursor-pointer"
                  title="Auto-fill Last Reading from the most recent bill for this unit"
                >
                  <Zap className="w-3 h-3 text-amber-600 fill-amber-500" />
                  Auto-Fill Last Reading
                </button>
              </div>

              {autoFilledNotice && (
                <div className="mb-3 text-[11px] text-stone-700 bg-stone-100 p-2 rounded border border-stone-200">
                  {autoFilledNotice}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <span className="text-[11px] font-medium text-stone-600 block mb-1">
                    Last Reading (kWh)
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={lastReading}
                    onChange={(e) => setLastReading(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full text-sm font-semibold px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#2C332B] bg-stone-50"
                  />
                </div>

                <div>
                  <span className="text-[11px] font-medium text-stone-600 block mb-1">
                    Current Reading (kWh)
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={currentReading}
                    onChange={(e) => setCurrentReading(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full text-sm font-semibold px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#2C332B] bg-stone-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-[#EFECE6] p-3 rounded-lg border border-[#DFDDD4] text-center text-xs">
                <div>
                  <span className="text-[10px] text-stone-600 uppercase font-bold block">
                    Consumption
                  </span>
                  <span className="text-sm font-bold text-stone-900">
                    {consumptionKwh.toFixed(1)} kWh
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-600 uppercase font-bold block">
                    Rate per kWh
                  </span>
                  <div className="flex items-center justify-center">
                    <PesoSymbol className="w-2.5 h-2.5 text-stone-700 mr-1" />
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      value={ratePerKwh}
                      onChange={(e) => setRatePerKwh(parseFloat(e.target.value) || 0)}
                      className="w-14 text-center font-bold text-xs bg-white border border-stone-300 rounded px-1 py-0.5"
                    />
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-stone-600 uppercase font-bold block">
                    Total Elec Bill
                  </span>
                  <span className="text-sm font-bold text-[#2C332B]">
                    <CurrencyText amount={electricityTotal} />
                  </span>
                </div>
              </div>
            </div>

            {/* Rent & Additional Charge Rows */}
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider">
                  Rent & Additional Charges
                </label>
                <button
                  type="button"
                  onClick={handleAddRentRow}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2C332B] bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded-md border border-stone-300 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  Add Row
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {rentItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleRentItemChange(item.id, 'description', e.target.value)}
                      placeholder="e.g. Rent October"
                      className="flex-1 text-xs font-medium px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-[#2C332B]"
                    />
                    <div className="relative w-28">
                      <PesoSymbol className="w-3 h-3 text-stone-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="number"
                        step="50"
                        min="0"
                        value={item.amount}
                        onChange={(e) => handleRentItemChange(item.id, 'amount', e.target.value)}
                        className="w-full text-xs font-semibold pl-6 pr-2 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-[#2C332B] text-right"
                      />
                    </div>
                    {rentItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRentRow(item.id)}
                        className="p-2 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Total Summary Footer */}
            <div className="bg-[#2C332B] text-white p-4 rounded-xl flex items-center justify-between shadow-md">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-stone-300 font-semibold block">
                  Total Amount Due (Rounded Up)
                </span>
                <span className="text-xl sm:text-2xl font-extrabold text-amber-200 font-sans">
                  <CurrencyText amount={totalAmountDue} roundUp noDecimals />
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-stone-700 hover:bg-stone-600 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-amber-400 text-stone-950 hover:bg-amber-300 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : initialBill ? 'Update Bill' : 'Save & Sync Bill'}
                </button>
              </div>
            </div>
          </form>

          {/* Right Column: Live Invoice Preview */}
          <div
            className={`md:col-span-6 flex flex-col items-center justify-start bg-stone-100 p-2 sm:p-4 rounded-xl border border-stone-200 overflow-y-auto ${
              activeTabMobile === 'form' ? 'hidden md:flex' : 'flex'
            }`}
          >
            <div className="w-full max-w-[440px] mb-2 flex items-center justify-between text-xs text-stone-600 font-semibold uppercase tracking-wider px-1">
              <span>Live Generated Invoice Card</span>
              <span className="text-stone-400 font-normal lowercase">(matches attached reference)</span>
            </div>
            <InvoiceCard bill={previewBill} unitAddress={propertyAddress} />
          </div>
        </div>
      </div>
    </div>
  );
};
