import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Eye,
  Building2,
  Calendar,
  Image as ImageIcon,
} from 'lucide-react';
import {
  ApartmentUnit,
  Bill,
  UnitInfo,
  computeUnitPaymentTracker,
  getAvailableMonths,
  formatMonthLabel,
} from '../utils/billing';
import { CurrencyText } from './CurrencyText';

interface UnitStatusTrackerCardProps {
  bills: Bill[];
  unitInfoMap: Record<ApartmentUnit, UnitInfo>;
  selectedUnitFilter: ApartmentUnit | 'ALL';
  onSelectUnitFilter: (unit: ApartmentUnit | 'ALL') => void;
  onViewInvoice: (bill: Bill) => void;
  onViewProofBill: (bill: Bill) => void;
  isViewerMode?: boolean;
}

export const UnitStatusTrackerCard: React.FC<UnitStatusTrackerCardProps> = ({
  bills,
  unitInfoMap,
  selectedUnitFilter,
  onSelectUnitFilter,
  onViewInvoice,
  onViewProofBill,
  isViewerMode = false,
}) => {
  const [trackerMonth, setTrackerMonth] = useState<string>('ALL');

  const availableMonths = useMemo(() => getAvailableMonths(bills), [bills]);

  const trackerItems = useMemo(
    () => computeUnitPaymentTracker(bills, unitInfoMap, trackerMonth),
    [bills, unitInfoMap, trackerMonth]
  );

  const summary = useMemo(() => {
    let paid = 0;
    let partial = 0;
    let unpaid = 0;
    let noBill = 0;
    trackerItems.forEach((item) => {
      if (item.status === 'PAID') paid += 1;
      else if (item.status === 'PARTIAL') partial += 1;
      else if (item.status === 'UNPAID') unpaid += 1;
      else noBill += 1;
    });
    return { paid, partial, unpaid, noBill };
  }, [trackerItems]);

  return (
    <section
      aria-label="Unit Payment Status Tracker"
      data-testid="unit-status-tracker"
      className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden"
    >
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-stone-500">
            <Building2 className="w-3.5 h-3.5 text-[#2C332B] shrink-0" />
            <span>Unit Payment Status Tracker</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-700 font-bold tabular-nums">{summary.paid} Paid</span>
            {summary.partial > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-700 font-bold tabular-nums">
                  {summary.partial} Partial
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="text-rose-700 font-bold tabular-nums">{summary.unpaid} Unpaid</span>
          </div>
          <h2 className="font-serif-invoice text-base sm:text-lg font-bold text-[#2C332B] mt-0.5">
            {isViewerMode
              ? 'Who is Paid or Unpaid — Tap Any Unit for Invoice or Receipt Proof'
              : 'Unit Payment & Proof Overview'}
          </h2>
        </div>

        {/* Period Filter Selector */}
        {bills.length > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Calendar className="w-4 h-4 text-stone-500 shrink-0" />
            <select
              aria-label="Filter tracker by month"
              value={trackerMonth}
              onChange={(e) => setTrackerMonth(e.target.value)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-xs font-bold text-[#2C332B] focus:outline-none focus:ring-2 focus:ring-[#2C332B] cursor-pointer tabular-nums"
            >
              <option value="ALL">Latest Statement per Unit</option>
              {availableMonths.map((mKey) => (
                <option key={mKey} value={mKey}>
                  {formatMonthLabel(mKey)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Units Grid / Mobile Touch Rows */}
      <div className="divide-y divide-stone-200">
        {trackerItems.map((item) => {
          const isUnitSelected = selectedUnitFilter === item.unit;
          const bill = item.latestBill;

          return (
            <div
              key={item.unit}
              data-testid={`tracker-unit-${item.unit}`}
              className={`p-3.5 sm:px-5 sm:py-4 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                isUnitSelected ? 'bg-amber-50/40' : 'hover:bg-stone-50/70'
              }`}
            >
              {/* Left: Unit Identity + Current Statement Period + Status */}
              <div className="flex items-start justify-between md:justify-start gap-3 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() =>
                    onSelectUnitFilter(isUnitSelected ? 'ALL' : item.unit)
                  }
                  aria-label={`Filter statements by ${item.unit}`}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0 transition-colors cursor-pointer flex flex-col items-start justify-center ${
                    isUnitSelected
                      ? 'bg-[#2C332B] text-amber-200'
                      : 'bg-stone-100 text-[#2C332B] hover:bg-stone-200'
                  }`}
                >
                  <span>{item.unit}</span>
                  {item.tenantName && (
                    <span
                      className={`text-[10px] font-medium normal-case truncate max-w-[96px] ${
                        isUnitSelected ? 'text-stone-200' : 'text-stone-500'
                      }`}
                    >
                      {item.tenantName}
                    </span>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Clear Semantic Status Text + Icon */}
                    {item.status === 'PAID' && (
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>PAID IN FULL</span>
                      </span>
                    )}
                    {item.status === 'PARTIAL' && (
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-800">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>PARTIAL PAYMENT</span>
                      </span>
                    )}
                    {item.status === 'UNPAID' && (
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-rose-700">
                        <Clock className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>UNPAID</span>
                      </span>
                    )}
                    {item.status === 'NO_BILL' && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-stone-400">
                        <span>No Statement Yet</span>
                      </span>
                    )}

                  </div>

                  {/* Period + Financial & Payment Proof Details */}
                  {bill ? (
                    <div className="mt-1 space-y-0.5 text-xs">
                      <p className="font-bold text-stone-800 truncate">
                        {item.billingPeriod}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 tabular-nums text-stone-600">
                        <span>
                          Total Due:{' '}
                          <strong className="text-stone-900">
                            <CurrencyText amount={item.totalDue} roundUp noDecimals />
                          </strong>
                        </span>

                        {item.amountPaid > 0 && (
                          <span className="text-emerald-800 font-semibold">
                            Paid: <CurrencyText amount={item.amountPaid} />
                            {item.paymentMethod ? ` (${item.paymentMethod})` : ''}
                          </span>
                        )}

                        {item.remainingBalance > 0 && (
                          <span className="text-rose-700 font-bold">
                            Balance Due:{' '}
                            <CurrencyText amount={item.remainingBalance} roundUp noDecimals />
                          </span>
                        )}

                        {item.referenceNo && (
                          <span className="font-mono text-[11px] text-stone-500">
                            Ref: {item.referenceNo}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      No billing statement recorded for this period.
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Large Cellphone Touch Action Buttons (View Invoice & View Proof) */}
              {bill && (
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0 pt-1 md:pt-0">
                  <button
                    type="button"
                    onClick={() => onViewInvoice(bill)}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold bg-[#2C332B] text-white hover:bg-[#1E231D] transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                    <span>View Invoice</span>
                  </button>

                  {item.hasProof || item.status === 'PAID' || item.status === 'PARTIAL' ? (
                    <button
                      type="button"
                      onClick={() => onViewProofBill(bill)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      {item.hasReceiptImage ? (
                        <ImageIcon className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      )}
                      <span>
                        {item.hasReceiptImage ? 'Receipt Photo' : 'Payment Proof'}
                      </span>
                    </button>
                  ) : (
                    <div className="min-h-[44px] px-3 py-2 rounded-xl text-[11px] font-semibold bg-stone-100 text-stone-400 border border-stone-200 flex items-center justify-center whitespace-nowrap">
                      No Proof Yet
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
