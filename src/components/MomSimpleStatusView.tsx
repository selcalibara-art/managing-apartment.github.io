import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Image as ImageIcon,
  Share2,
  Check,
  Smartphone,
  Building2,
} from 'lucide-react';
import {
  Bill,
  ApartmentUnit,
  UnitInfo,
  computeSimpleUnitStatuses,
  getAvailableMonths,
  formatMonthLabel,
} from '../utils/billing';
import { CurrencyText } from './CurrencyText';

interface MomSimpleStatusViewProps {
  bills: Bill[];
  unitInfoMap: Record<ApartmentUnit, UnitInfo>;
  onViewInvoice: (bill: Bill) => void;
  onViewProof: (url: string, title: string) => void;
  isDedicatedMomMode?: boolean;
  onEnableDedicatedMomMode?: () => void;
}

export const MomSimpleStatusView: React.FC<MomSimpleStatusViewProps> = ({
  bills,
  unitInfoMap,
  onViewInvoice,
  onViewProof,
  isDedicatedMomMode = false,
  onEnableDedicatedMomMode,
}) => {
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>('LATEST');
  const [copiedMomLink, setCopiedMomLink] = useState(false);

  const availableMonths = useMemo(() => getAvailableMonths(bills), [bills]);

  const overview = useMemo(
    () => computeSimpleUnitStatuses(bills, unitInfoMap, selectedPeriodKey),
    [bills, unitInfoMap, selectedPeriodKey]
  );

  const handleCopyMomLink = async () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'mom');
      await navigator.clipboard.writeText(url.toString());
      setCopiedMomLink(true);
      setTimeout(() => setCopiedMomLink(false), 3000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col gap-4">
      {/* Simple Top Summary Card */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="font-serif-invoice text-lg sm:text-xl font-bold text-[#2C332B]">
              Unit Payment Status
            </h2>
            <p className="text-xs text-stone-500">
              {selectedPeriodKey === 'LATEST'
                ? 'Latest billing status for each apartment unit'
                : `Status for ${formatMonthLabel(selectedPeriodKey)}`}
            </p>
          </div>

          {/* Month Filter (Only shown if bills exist across months) */}
          {bills.length > 0 && availableMonths.length > 1 && (
            <select
              value={selectedPeriodKey}
              onChange={(e) => setSelectedPeriodKey(e.target.value)}
              aria-label="Select billing month"
              className="px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 text-xs font-bold text-stone-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2C332B]"
            >
              <option value="LATEST">Current / Latest Bill</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Simple 2-Box Money Summary + Status Pills */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-emerald-50/80 border border-emerald-200 p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
              Paid / Collected
            </span>
            <p className="text-xl sm:text-2xl font-extrabold text-emerald-700 mt-0.5 tabular-nums">
              <CurrencyText amount={overview.totalCollectedAmount} roundUp noDecimals />
            </p>
            <span className="text-xs font-semibold text-emerald-800/80 mt-0.5 block">
              {overview.paidUnitsCount} {overview.paidUnitsCount === 1 ? 'unit' : 'units'} paid in full
            </span>
          </div>

          <div
            className={`rounded-xl border p-3.5 ${
              overview.totalRemainingToCollect > 0
                ? 'bg-rose-50/80 border-rose-200'
                : 'bg-stone-50 border-stone-200'
            }`}
          >
            <span
              className={`text-[11px] font-bold uppercase tracking-wider block ${
                overview.totalRemainingToCollect > 0 ? 'text-rose-800' : 'text-stone-500'
              }`}
            >
              Still Unpaid
            </span>
            <p
              className={`text-xl sm:text-2xl font-extrabold mt-0.5 tabular-nums ${
                overview.totalRemainingToCollect > 0 ? 'text-rose-700' : 'text-stone-700'
              }`}
            >
              <CurrencyText amount={overview.totalRemainingToCollect} roundUp noDecimals />
            </p>
            <span
              className={`text-xs font-semibold mt-0.5 block ${
                overview.totalRemainingToCollect > 0 ? 'text-rose-800/80' : 'text-stone-500'
              }`}
            >
              {overview.unpaidUnitsCount + overview.partialUnitsCount === 0
                ? 'All billed units paid'
                : `${overview.unpaidUnitsCount + overview.partialUnitsCount} ${
                    overview.unpaidUnitsCount + overview.partialUnitsCount === 1 ? 'unit' : 'units'
                  } with balance`}
            </span>
          </div>
        </div>
      </div>

      {/* One Simple Card Per Unit */}
      <div className="flex flex-col gap-3">
        {overview.items.map((item) => {
          const isPaid = item.status === 'PAID';
          const isPartial = item.status === 'PARTIAL';
          const isUnpaid = item.status === 'UNPAID';
          const isNoBill = item.status === 'NO_BILL';

          return (
            <div
              key={item.unit}
              className={`rounded-2xl border p-4 sm:p-5 shadow-2xs transition-all bg-white ${
                isPaid
                  ? 'border-emerald-300 border-l-4 border-l-emerald-600'
                  : isPartial
                  ? 'border-amber-300 border-l-4 border-l-amber-500'
                  : isUnpaid
                  ? 'border-rose-300 border-l-4 border-l-rose-600'
                  : 'border-stone-200 opacity-80'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Left: Unit Name & Period */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg sm:text-xl font-extrabold text-[#2C332B] tracking-wide">
                      {item.unit}
                    </span>
                    {item.tenantName && (
                      <span className="text-sm font-semibold text-stone-600">
                        · {item.tenantName}
                      </span>
                    )}
                  </div>

                  {isNoBill ? (
                    <p className="text-xs text-stone-400 font-medium mt-1">
                      No billing statement yet
                    </p>
                  ) : (
                    <div className="mt-1 flex flex-col gap-0.5">
                      <p className="text-sm font-semibold text-stone-800">
                        {item.billingPeriod}
                      </p>
                      {isPaid && (
                        <p className="text-xs text-emerald-700 font-medium">
                          Paid{item.datePaid ? ` on ${item.datePaid}` : ''}
                          {item.paymentMethod ? ` via ${item.paymentMethod}` : ''}
                        </p>
                      )}
                      {isPartial && (
                        <p className="text-xs text-amber-800 font-medium">
                          Paid <CurrencyText amount={item.amountPaid} roundUp noDecimals /> of{' '}
                          <CurrencyText amount={item.totalDue} roundUp noDecimals />
                        </p>
                      )}
                      {isUnpaid && item.billingDate && (
                        <p className="text-xs text-stone-500">
                          Billed on {item.billingDate}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Big Status Badge & Amount */}
                <div className="flex flex-col items-end shrink-0 text-right">
                  {isPaid && (
                    <>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs sm:text-sm font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        <span>PAID</span>
                      </span>
                      <span className="text-lg sm:text-xl font-extrabold text-emerald-700 mt-1.5 tabular-nums">
                        <CurrencyText amount={item.totalDue} roundUp noDecimals />
                      </span>
                    </>
                  )}

                  {isPartial && (
                    <>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs sm:text-sm font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-300">
                        <AlertCircle className="w-4 h-4 text-amber-700" />
                        <span>PARTIAL</span>
                      </span>
                      <span className="text-lg sm:text-xl font-extrabold text-rose-700 mt-1.5 tabular-nums">
                        <CurrencyText amount={item.remainingBalance} roundUp noDecimals />{' '}
                        <span className="text-xs font-bold">left</span>
                      </span>
                    </>
                  )}

                  {isUnpaid && (
                    <>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs sm:text-sm font-extrabold uppercase bg-rose-100 text-rose-800 border border-rose-300">
                        <Clock className="w-4 h-4 text-rose-700" />
                        <span>UNPAID</span>
                      </span>
                      <span className="text-lg sm:text-xl font-extrabold text-rose-700 mt-1.5 tabular-nums">
                        <CurrencyText amount={item.totalDue} roundUp noDecimals />
                      </span>
                    </>
                  )}

                  {isNoBill && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold uppercase bg-stone-100 text-stone-500 border border-stone-200">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>NO BILL</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Simple Action Buttons (Only when unit has a bill) */}
              {item.latestBill && (
                <div className="mt-3.5 pt-3 border-t border-stone-100 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onViewInvoice(item.latestBill!)}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#2C332B] text-white hover:bg-[#1E231D] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Eye className="w-4 h-4 shrink-0" />
                    <span>View Bill</span>
                  </button>

                  {item.hasReceiptPhoto && item.latestBill.paymentProof?.dataUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        onViewProof(
                          item.latestBill!.paymentProof!.dataUrl!,
                          `${item.unit} · ${item.billingPeriod} Receipt`
                        )
                      }
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <ImageIcon className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>View Receipt</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Landlord Helper Bar (Only shown when previewing from Admin Mode) */}
      {!isDedicatedMomMode && (
        <div className="bg-stone-200/70 rounded-2xl p-4 border border-stone-300/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-[#2C332B] flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-stone-700" />
              <span>Share or Set Up on Mom&apos;s Phone</span>
            </p>
            <p className="text-[11px] text-stone-600 mt-0.5">
              Send this link to your mom so her phone opens straight into this simple view without any admin buttons.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyMomLink}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-[#2C332B] border border-stone-300 hover:bg-stone-50 transition-colors cursor-pointer shadow-2xs"
            >
              {copiedMomLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Link Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Copy Mom&apos;s Link</span>
                </>
              )}
            </button>

            {onEnableDedicatedMomMode && (
              <button
                type="button"
                onClick={onEnableDedicatedMomMode}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#2C332B] text-white hover:bg-[#1E231D] transition-colors cursor-pointer shadow-2xs"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Full-Screen Mom Mode</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
