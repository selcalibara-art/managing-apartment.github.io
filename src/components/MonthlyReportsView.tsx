import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Zap,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Download,
  Plus,
  Eye,
  ChevronLeft,
  ChevronRight,
  Building2,
  BarChart3,
  FileText,
} from 'lucide-react';
import {
  ApartmentUnit,
  Bill,
  UnitInfo,
  formatCurrency,
  formatKwh,
  formatReading,
  formatMonthLabel,
  formatShortMonthLabel,
  getAvailableMonths,
  computeMonthlyReport,
  computeMonthlyTrendSeries,
  hasPaymentProofDetails,
} from '../utils/billing';
import { CurrencyText } from './CurrencyText';

interface MonthlyReportsViewProps {
  bills: Bill[];
  unitInfoMap: Record<ApartmentUnit, UnitInfo>;
  selectedMonth: string;
  onSelectMonth: (monthKey: string) => void;
  onOpenNewBill: (unit?: ApartmentUnit) => void;
  onViewInvoice: (bill: Bill) => void;
  onRecordPayment: (bill: Bill) => void;
  onViewProof: (url: string, title: string) => void;
}

export const MonthlyReportsView: React.FC<MonthlyReportsViewProps> = ({
  bills,
  unitInfoMap,
  selectedMonth,
  onSelectMonth,
  onOpenNewBill,
  onViewInvoice,
  onRecordPayment,
  onViewProof,
}) => {
  const [unitRowFilter, setUnitRowFilter] = useState<'ALL' | 'BILLED' | 'OWING' | 'UNBILLED'>('ALL');

  const currentCalendarMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const availableMonths = useMemo(
    () => getAvailableMonths(bills, currentCalendarMonth),
    [bills, currentCalendarMonth]
  );

  // Ensure selectedMonth is valid; if not in availableMonths and not 'ALL', still allow custom YYYY-MM
  const activeMonthKey = selectedMonth || availableMonths[0] || currentCalendarMonth;

  const report = useMemo(
    () => computeMonthlyReport(bills, activeMonthKey, unitInfoMap),
    [bills, activeMonthKey, unitInfoMap]
  );

  const trendSeries = useMemo(() => computeMonthlyTrendSeries(bills), [bills]);

  // Max values for scaling visual trend bars
  const maxTrendKwh = useMemo(() => {
    const max = Math.max(...trendSeries.map((t) => t.totalConsumptionKwh), 0);
    return max > 0 ? max : 100;
  }, [trendSeries]);

  const maxUnitKwh = useMemo(() => {
    const max = Math.max(...report.unitBreakdowns.map((u) => u.consumptionKwh), 0);
    return max > 0 ? max : 100;
  }, [report.unitBreakdowns]);

  // Payment method distribution for the selected month
  const paymentMethodBreakdown = useMemo(() => {
    const map: Record<string, { count: number; amount: number }> = {};
    report.unitBreakdowns.forEach((u) => {
      u.bills.forEach((b) => {
        const paid = b.paymentProof?.amountPaid ?? (b.isPaid ? b.totalAmountDue : 0);
        if (paid > 0) {
          const method = b.paymentProof?.paymentMethod || 'Unspecified';
          if (!map[method]) {
            map[method] = { count: 0, amount: 0 };
          }
          map[method].count += 1;
          map[method].amount += paid;
        }
      });
    });
    return Object.entries(map).sort((a, b) => b[1].amount - a[1].amount);
  }, [report.unitBreakdowns]);

  // Filtered unit breakdown rows
  const filteredUnitRows = useMemo(() => {
    return report.unitBreakdowns.filter((row) => {
      if (unitRowFilter === 'BILLED') return row.billCount > 0;
      if (unitRowFilter === 'OWING') return row.remainingBalance > 0;
      if (unitRowFilter === 'UNBILLED') return row.billCount === 0;
      return true;
    });
  }, [report.unitBreakdowns, unitRowFilter]);

  // Step to previous or next available month
  const currentMonthIdx = availableMonths.indexOf(activeMonthKey);
  const canGoOlder = currentMonthIdx >= 0 && currentMonthIdx < availableMonths.length - 1;
  const canGoNewer = currentMonthIdx > 0;

  const handleStepOlder = () => {
    if (canGoOlder) {
      onSelectMonth(availableMonths[currentMonthIdx + 1]);
    }
  };

  const handleStepNewer = () => {
    if (canGoNewer) {
      onSelectMonth(availableMonths[currentMonthIdx - 1]);
    }
  };

  // Export CSV handler for selected month report
  const handleExportCsv = () => {
    const headers = [
      'Month',
      'Unit',
      'Tenant Name',
      'Property Address',
      'Bills Count',
      'Consumption (kWh)',
      'Electricity Billed (PHP)',
      'Rent & Other (PHP)',
      'Total Billed (PHP)',
      'Amount Paid (PHP)',
      'Remaining Balance (PHP)',
      'Collection Rate (%)',
      'Payment Status',
    ];

    const rows = report.unitBreakdowns.map((u) => [
      report.monthLabel,
      u.unit,
      `"${(u.tenantName || '').replace(/"/g, '""')}"`,
      `"${(u.propertyAddress || '').replace(/"/g, '""')}"`,
      String(u.billCount),
      u.consumptionKwh.toFixed(2),
      u.electricityTotal.toFixed(2),
      u.rentAndOtherTotal.toFixed(2),
      u.totalBilled.toFixed(2),
      u.amountPaid.toFixed(2),
      u.remainingBalance.toFixed(2),
      u.collectionRate.toFixed(1),
      u.status,
    ]);

    rows.push([
      report.monthLabel,
      'TOTAL SUMMARY',
      '""',
      '""',
      String(report.billCount),
      report.totalConsumptionKwh.toFixed(2),
      report.totalElectricityBilled.toFixed(2),
      report.totalRentAndOtherBilled.toFixed(2),
      report.totalBilled.toFixed(2),
      report.totalCollected.toFixed(2),
      report.totalRemaining.toFixed(2),
      report.collectionRate.toFixed(1),
      `${report.paidCount} Paid / ${report.partialCount} Partial / ${report.unpaidCount} Unpaid`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Calibara_Monthly_Report_${activeMonthKey}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-5" data-testid="monthly-reports-view">
      {/* Month Selection & Report Header Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-stone-500">
              <Calendar className="w-3.5 h-3.5 text-stone-600 shrink-0" />
              <span>Monthly Billing & Consumption Ledger</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {report.billCount} {report.billCount === 1 ? 'statement' : 'statements'}
              </span>
            </div>
            <h2 className="font-serif-invoice text-xl sm:text-2xl font-bold text-[#2C332B] tracking-wide mt-0.5">
              {report.monthLabel} Report
            </h2>
          </div>

          {/* Month Controls & Export Action */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Prev / Next Month Stepper */}
            <div className="flex items-center bg-stone-100 rounded-xl p-1 border border-stone-200">
              <button
                type="button"
                onClick={handleStepOlder}
                disabled={!canGoOlder}
                aria-label="Previous billing month"
                title="Older billing month"
                className="p-1.5 rounded-lg text-stone-700 hover:bg-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <select
                aria-label="Select Report Month"
                value={activeMonthKey}
                onChange={(e) => onSelectMonth(e.target.value)}
                className="bg-transparent px-2.5 py-1 text-xs font-bold text-[#2C332B] focus:outline-none cursor-pointer tabular-nums"
              >
                {availableMonths.map((mKey) => (
                  <option key={mKey} value={mKey}>
                    {formatMonthLabel(mKey)}
                  </option>
                ))}
                {!availableMonths.includes(activeMonthKey) && activeMonthKey !== 'ALL' && (
                  <option value={activeMonthKey}>{formatMonthLabel(activeMonthKey)}</option>
                )}
                <option value="ALL">All Billing Months (Cumulative)</option>
              </select>

              <button
                type="button"
                onClick={handleStepNewer}
                disabled={!canGoNewer}
                aria-label="Next billing month"
                title="Newer billing month"
                className="p-1.5 rounded-lg text-stone-700 hover:bg-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Direct Month Calendar Picker */}
            <div className="flex items-center">
              <input
                type="month"
                aria-label="Pick custom month"
                value={activeMonthKey === 'ALL' ? currentCalendarMonth : activeMonthKey}
                onChange={(e) => {
                  if (e.target.value) {
                    onSelectMonth(e.target.value);
                  }
                }}
                className="px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#2C332B] tabular-nums"
              />
            </div>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#2C332B] text-white hover:bg-[#1E231D] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Quick Month Switcher Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-stone-100 pb-0.5">
          <span className="text-[11px] font-semibold text-stone-400 mr-1 whitespace-nowrap">
            Billing Periods:
          </span>
          {availableMonths.map((mKey) => {
            const isSelected = activeMonthKey === mKey;
            const monthCount = bills.filter((b) => {
              const bKey = (b.billingDate || b.createdAt || '').slice(0, 7);
              return bKey === mKey;
            }).length;

            return (
              <button
                key={mKey}
                type="button"
                onClick={() => onSelectMonth(mKey)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer tabular-nums shrink-0 ${
                  isSelected
                    ? 'bg-[#2C332B] text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {formatShortMonthLabel(mKey)} ({monthCount})
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onSelectMonth('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer tabular-nums shrink-0 ${
              activeMonthKey === 'ALL'
                ? 'bg-[#2C332B] text-white'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            All Time ({bills.length})
          </button>
        </div>
      </div>

      {/* 4 Primary Monthly KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Payment Collection Rate */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-stone-500 mb-1">
              <span className="text-xs font-bold text-stone-600">Collection Rate</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <p
                className="text-2xl sm:text-3xl font-extrabold text-[#2C332B] tabular-nums"
                data-testid="report-collection-rate"
              >
                {report.collectionRate.toFixed(1)}%
              </p>
              {report.collectionRateDeltaPts !== null && (
                <span
                  className={`text-xs font-bold tabular-nums flex items-center gap-0.5 ${
                    report.collectionRateDeltaPts >= 0 ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {report.collectionRateDeltaPts >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {report.collectionRateDeltaPts > 0 ? '+' : ''}
                  {report.collectionRateDeltaPts.toFixed(1)} pts
                </span>
              )}
            </div>
          </div>

          <div className="mt-3">
            <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-600 h-full transition-all duration-200"
                style={{ width: `${Math.min(100, report.collectionRate)}%` }}
              />
            </div>
            <p className="text-[11px] text-stone-500 mt-1.5 tabular-nums">
              {report.paidCount} paid in full · {report.partialCount} partial · {report.unpaidCount}{' '}
              unpaid
            </p>
          </div>
        </div>

        {/* Card 2: Monthly Collected vs Total Billed */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-stone-500 mb-1">
              <span className="text-xs font-bold text-stone-600">Collected / Total Billed</span>
              <FileText className="w-4 h-4 text-stone-700" />
            </div>
            <p
              className="text-xl sm:text-2xl font-bold text-emerald-700 tabular-nums"
              data-testid="report-total-collected"
            >
              <CurrencyText amount={report.totalCollected} />
            </p>
            <p className="text-xs text-stone-500 mt-0.5 tabular-nums">
              of <CurrencyText amount={report.totalBilled} className="font-semibold text-stone-800" />{' '}
              total billed
            </p>
          </div>

          <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between text-xs tabular-nums">
            <span className="text-stone-500 font-medium">Unpaid Balance:</span>
            <span
              className={`font-bold ${
                report.totalRemaining > 0 ? 'text-amber-700' : 'text-stone-600'
              }`}
              data-testid="report-total-remaining"
            >
              <CurrencyText amount={report.totalRemaining} />
            </span>
          </div>
        </div>

        {/* Card 3: Electricity Consumption (kWh) */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-stone-500 mb-1">
              <span className="text-xs font-bold text-stone-600">Electricity Consumption</span>
              <Zap className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <p
                className="text-xl sm:text-2xl font-bold text-stone-900 tabular-nums"
                data-testid="report-total-kwh"
              >
                {report.totalConsumptionKwh.toFixed(1)}{' '}
                <span className="text-xs font-semibold text-stone-500">kWh</span>
              </p>
              {report.consumptionChangePct !== null && (
                <span
                  className={`text-xs font-bold tabular-nums flex items-center gap-0.5 ${
                    report.consumptionChangePct <= 0 ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                  title={`Compared to ${formatShortMonthLabel(report.prevMonthKey || '')}`}
                >
                  {report.consumptionChangePct > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {report.consumptionChangePct > 0 ? '+' : ''}
                  {report.consumptionChangePct.toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-0.5 tabular-nums">
              Avg {formatKwh(report.avgConsumptionPerBilledUnitKwh)} per billed unit
            </p>
          </div>

          <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between text-xs tabular-nums">
            <span className="text-stone-500 font-medium">Electricity Billed:</span>
            <span className="font-bold text-stone-800">
              <CurrencyText amount={report.totalElectricityBilled} />
            </span>
          </div>
        </div>

        {/* Card 4: Rent & Unit Billing Coverage */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-stone-500 mb-1">
              <span className="text-xs font-bold text-stone-600">Rent & Unit Coverage</span>
              <Building2 className="w-4 h-4 text-stone-700" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-[#2C332B] tabular-nums">
              <CurrencyText amount={report.totalRentAndOtherBilled} />
            </p>
            <p className="text-xs text-stone-500 mt-0.5 tabular-nums">
              Rent & additional charges billed
            </p>
          </div>

          <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between text-xs tabular-nums">
            <span className="text-stone-500 font-medium">Units Billed:</span>
            <span className="font-bold text-stone-800">
              {report.unitsBilledCount} of {report.totalUnitsCount} units
            </span>
          </div>
        </div>
      </div>

      {/* Multi-Month Trend & Unit Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Panel: Electricity Consumption Trends & Per-Unit kWh Share */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#2C332B] flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Electricity Consumption Trends (kWh)</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Submeter usage across billing months and unit share for {report.monthLabel}
                </p>
              </div>
              {report.highestConsumingUnit && (
                <div className="text-right text-xs tabular-nums shrink-0">
                  <span className="text-stone-400 block text-[11px]">Peak Unit</span>
                  <span className="font-bold text-stone-800">
                    {report.highestConsumingUnit.unit} ({formatKwh(report.highestConsumingUnit.kwh)})
                  </span>
                </div>
              )}
            </div>

            {/* Month-over-Month Electricity Bar Chart */}
            {trendSeries.length > 0 ? (
              <div className="mt-4 flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-stone-500">
                  Monthly Submeter Usage History (Click month to inspect)
                </span>
                <div className="flex flex-col gap-2">
                  {trendSeries.slice(-6).map((point) => {
                    const widthPct = Math.max(
                      4,
                      Math.min(100, (point.totalConsumptionKwh / maxTrendKwh) * 100)
                    );
                    const isCurrent = point.monthKey === activeMonthKey;
                    return (
                      <button
                        key={point.monthKey}
                        type="button"
                        onClick={() => onSelectMonth(point.monthKey)}
                        className={`w-full text-left p-2.5 rounded-xl border transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-stone-100/90 border-[#2C332B]'
                            : 'bg-stone-50/60 border-stone-200/80 hover:bg-stone-100/60'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1 text-xs mb-1 tabular-nums">
                          <span className="font-bold text-stone-800">
                            {point.shortLabel}
                            <span className="text-stone-400 font-normal ml-1.5">
                              · {point.billCount} {point.billCount === 1 ? 'bill' : 'bills'}
                            </span>
                          </span>
                          <span className="font-bold text-stone-900">
                            {formatKwh(point.totalConsumptionKwh)}{' '}
                            <span className="text-stone-500 font-normal">
                              (<CurrencyText amount={point.totalElectricityBilled} />)
                            </span>
                          </span>
                        </div>
                        <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-200 ${
                              isCurrent ? 'bg-[#2C332B]' : 'bg-blue-600/75'
                            }`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-4 p-6 bg-stone-50 rounded-xl border border-stone-200 text-center text-xs text-stone-500">
                No submeter readings recorded yet. Create a bill to track monthly kWh usage trends.
              </div>
            )}
          </div>

          {/* Per-Unit Consumption Share for Selected Month */}
          <div className="pt-3 border-t border-stone-100">
            <span className="text-[11px] font-semibold text-stone-500 block mb-2">
              Unit Submeter Breakdown ({report.monthLabel})
            </span>
            <div className="flex flex-col gap-1.5">
              {report.unitBreakdowns.map((u) => {
                const pct =
                  report.totalConsumptionKwh > 0
                    ? (u.consumptionKwh / report.totalConsumptionKwh) * 100
                    : 0;
                const barWidth =
                  u.consumptionKwh > 0 ? Math.max(4, (u.consumptionKwh / maxUnitKwh) * 100) : 0;

                return (
                  <div key={u.unit} className="flex items-center gap-3 text-xs tabular-nums">
                    <span className="w-20 font-bold text-stone-700 truncate shrink-0">
                      {u.unit}
                    </span>
                    <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-600 rounded-full transition-all duration-200"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="w-28 text-right font-semibold text-stone-800 shrink-0">
                      {formatKwh(u.consumptionKwh)}{' '}
                      <span className="text-stone-400 font-normal">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Panel: Payment Collection Rate Trends & Payment Channels */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#2C332B] flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Payment Collection Rate Trends</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Collection rate (%) and collected vs unpaid balance across billing periods
                </p>
              </div>
              <div className="text-right text-xs tabular-nums shrink-0">
                <span className="text-stone-400 block text-[11px]">Avg Electricity Rate</span>
                <span className="font-bold text-stone-800">
                  {report.averageRatePerKwh > 0 ? (
                    <>
                      <CurrencyText amount={report.averageRatePerKwh} /> / kWh
                    </>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
            </div>

            {trendSeries.length > 0 ? (
              <div className="mt-4 flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-stone-500">
                  Monthly Collection Rate History (Click month to inspect)
                </span>
                <div className="flex flex-col gap-2">
                  {trendSeries.slice(-6).map((point) => {
                    const isCurrent = point.monthKey === activeMonthKey;
                    return (
                      <button
                        key={point.monthKey}
                        type="button"
                        onClick={() => onSelectMonth(point.monthKey)}
                        className={`w-full text-left p-2.5 rounded-xl border transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-stone-100/90 border-[#2C332B]'
                            : 'bg-stone-50/60 border-stone-200/80 hover:bg-stone-100/60'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1 text-xs mb-1 tabular-nums">
                          <span className="font-bold text-stone-800">
                            {point.shortLabel}
                            <span className="text-stone-400 font-normal ml-1.5">
                              · {point.paidCount} paid · {point.partialCount} partial ·{' '}
                              {point.unpaidCount} unpaid
                            </span>
                          </span>
                          <span className="font-bold text-emerald-800">
                            {point.collectionRate.toFixed(1)}%{' '}
                            <span className="text-stone-500 font-normal">
                              (<CurrencyText amount={point.totalCollected} /> /{' '}
                              <CurrencyText amount={point.totalBilled} />)
                            </span>
                          </span>
                        </div>
                        <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-200 ${
                              point.collectionRate >= 99.9
                                ? 'bg-emerald-600'
                                : point.collectionRate > 0
                                ? 'bg-amber-500'
                                : 'bg-rose-400'
                            }`}
                            style={{ width: `${Math.max(2, point.collectionRate)}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-4 p-6 bg-stone-50 rounded-xl border border-stone-200 text-center text-xs text-stone-500">
                No payment collection history yet. Record payments on bills to track collection rates.
              </div>
            )}
          </div>

          {/* Payment Method & Collection Summary for Selected Month */}
          <div className="pt-3 border-t border-stone-100">
            <span className="text-[11px] font-semibold text-stone-500 block mb-2">
              Collection Channels ({report.monthLabel})
            </span>
            {paymentMethodBreakdown.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {paymentMethodBreakdown.map(([method, info]) => (
                  <div
                    key={method}
                    className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80 flex flex-col tabular-nums"
                  >
                    <span className="text-[11px] font-semibold text-stone-500">
                      {method} · {info.count}
                    </span>
                    <span className="text-xs font-bold text-stone-900 mt-0.5">
                      <CurrencyText amount={info.amount} />
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-400">
                No payments recorded for {report.monthLabel} yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Per-Unit Monthly Billing & Collection Ledger Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#2C332B]">
              Unit-by-Unit Monthly Ledger — {report.monthLabel}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Complete breakdown of submeter readings, electricity charges, rent, and collection
              status per apartment unit
            </p>
          </div>

          {/* Segmented Unit Filter */}
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
            <button
              type="button"
              onClick={() => setUnitRowFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                unitRowFilter === 'ALL'
                  ? 'bg-white text-stone-900 shadow-2xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              All Units ({report.unitBreakdowns.length})
            </button>
            <button
              type="button"
              onClick={() => setUnitRowFilter('BILLED')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                unitRowFilter === 'BILLED'
                  ? 'bg-white text-stone-900 shadow-2xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Billed ({report.unitsBilledCount})
            </button>
            <button
              type="button"
              onClick={() => setUnitRowFilter('OWING')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                unitRowFilter === 'OWING'
                  ? 'bg-white text-amber-900 shadow-2xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              With Balance (
              {report.unitBreakdowns.filter((u) => u.remainingBalance > 0).length})
            </button>
            <button
              type="button"
              onClick={() => setUnitRowFilter('UNBILLED')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                unitRowFilter === 'UNBILLED'
                  ? 'bg-white text-stone-900 shadow-2xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Unbilled ({report.totalUnitsCount - report.unitsBilledCount})
            </button>
          </div>
        </div>

        {/* Mobile Stacked Unit Ledger (< md) */}
        <div className="md:hidden divide-y divide-stone-200">
          {filteredUnitRows.map((row) => {
            const latestBill = row.bills[0];
            const hasProof = latestBill ? hasPaymentProofDetails(latestBill) : false;

            return (
              <div key={row.unit} className="p-4 flex flex-col gap-3 text-xs tabular-nums">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-stone-900">{row.unit}</div>
                    <div className="text-[11px] text-stone-500 truncate">
                      {row.tenantName || 'No tenant name set'}
                      {row.propertyAddress ? ` · ${row.propertyAddress}` : ''}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {row.status === 'PAID' && (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Paid (100%)</span>
                      </span>
                    )}
                    {row.status === 'PARTIAL' && (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-800">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Partial ({row.collectionRate.toFixed(0)}%)</span>
                      </span>
                    )}
                    {row.status === 'UNPAID' && (
                      <span className="inline-flex items-center gap-1 font-bold text-rose-700">
                        <Clock className="w-3.5 h-3.5 text-rose-600" />
                        <span>Unpaid (0%)</span>
                      </span>
                    )}
                    {row.status === 'NO_BILL' && (
                      <span className="text-stone-400 font-medium">No statement yet</span>
                    )}
                  </div>
                </div>

                {row.billCount > 0 ? (
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-stone-50 border border-stone-200/80">
                    <div>
                      <span className="text-[10px] text-stone-400 block">Submeter</span>
                      <span className="font-bold text-stone-800">
                        {formatKwh(row.consumptionKwh)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 block">Total Billed</span>
                      <span className="font-bold text-stone-900">
                        <CurrencyText amount={row.totalBilled} />
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 block">
                        {row.remainingBalance > 0 ? 'Balance Due' : 'Collected'}
                      </span>
                      <span
                        className={`font-bold ${
                          row.remainingBalance > 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        <CurrencyText
                          amount={row.remainingBalance > 0 ? row.remainingBalance : row.amountPaid}
                        />
                      </span>
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-2">
                  {latestBill ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onViewInvoice(latestBill)}
                        className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold transition-colors cursor-pointer"
                      >
                        View Invoice
                      </button>
                      <button
                        type="button"
                        onClick={() => onRecordPayment(latestBill)}
                        className="px-3 py-1.5 rounded-lg bg-[#2C332B] hover:bg-[#1E231D] text-white font-semibold transition-colors cursor-pointer"
                      >
                        {row.status === 'PAID' ? 'Payment Details' : 'Record Payment'}
                      </button>
                      {hasProof && latestBill.paymentProof?.dataUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            onViewProof(
                              latestBill.paymentProof!.dataUrl!,
                              `${latestBill.unit} - ${latestBill.billingPeriod} Payment Receipt`
                            )
                          }
                          aria-label={`View proof for ${row.unit}`}
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenNewBill(row.unit)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-stone-900 font-bold transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Bill for {row.unit}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Full Ledger Table (md and up) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs tabular-nums">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold">
                <th className="py-3 px-4">Unit & Tenant</th>
                <th className="py-3 px-3 text-right">Submeter Usage</th>
                <th className="py-3 px-3 text-right">Electricity</th>
                <th className="py-3 px-3 text-right">Rent & Other</th>
                <th className="py-3 px-3 text-right">Total Billed</th>
                <th className="py-3 px-3 text-right">Collected</th>
                <th className="py-3 px-3 text-right">Balance Due</th>
                <th className="py-3 px-3">Collection Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredUnitRows.map((row) => {
                const latestBill = row.bills[0];
                const hasProof = latestBill ? hasPaymentProofDetails(latestBill) : false;

                return (
                  <tr
                    key={row.unit}
                    className="hover:bg-stone-50/80 transition-colors"
                    data-testid={`report-unit-row-${row.unit}`}
                  >
                    {/* Unit & Tenant */}
                    <td className="py-3 px-4 max-w-[220px]">
                      <div className="font-bold text-stone-900">{row.unit}</div>
                      <div className="text-[11px] text-stone-500 truncate">
                        {row.tenantName || 'No tenant name set'}
                        {row.propertyAddress ? ` · ${row.propertyAddress}` : ''}
                      </div>
                    </td>

                    {/* Submeter Usage */}
                    <td className="py-3 px-3 text-right">
                      {row.billCount > 0 ? (
                        <div>
                          <div className="font-bold text-stone-800">
                            {formatKwh(row.consumptionKwh)}
                          </div>
                          {latestBill && row.billCount === 1 && (
                            <div className="text-[10px] text-stone-400">
                              {formatReading(latestBill.lastReading)} →{' '}
                              {formatReading(latestBill.currentReading)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>

                    {/* Electricity */}
                    <td className="py-3 px-3 text-right font-semibold text-stone-800">
                      {row.billCount > 0 ? (
                        <CurrencyText amount={row.electricityTotal} />
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>

                    {/* Rent & Other */}
                    <td className="py-3 px-3 text-right font-semibold text-stone-800">
                      {row.billCount > 0 ? (
                        <CurrencyText amount={row.rentAndOtherTotal} />
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>

                    {/* Total Billed */}
                    <td className="py-3 px-3 text-right font-bold text-[#2C332B]">
                      {row.billCount > 0 ? (
                        <CurrencyText amount={row.totalBilled} />
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>

                    {/* Collected */}
                    <td className="py-3 px-3 text-right font-bold text-emerald-700">
                      {row.billCount > 0 ? (
                        <CurrencyText amount={row.amountPaid} />
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>

                    {/* Remaining Balance */}
                    <td className="py-3 px-3 text-right font-bold">
                      {row.billCount > 0 ? (
                        <span
                          className={
                            row.remainingBalance > 0 ? 'text-rose-700' : 'text-stone-400'
                          }
                        >
                          <CurrencyText amount={row.remainingBalance} />
                        </span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      {row.status === 'PAID' && (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Paid in Full (100%)</span>
                        </span>
                      )}
                      {row.status === 'PARTIAL' && (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-800">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Partial ({row.collectionRate.toFixed(0)}%)</span>
                        </span>
                      )}
                      {row.status === 'UNPAID' && (
                        <span className="inline-flex items-center gap-1 font-bold text-rose-700">
                          <Clock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>Unpaid (0%)</span>
                        </span>
                      )}
                      {row.status === 'NO_BILL' && (
                        <span className="text-stone-400 font-medium">No statement yet</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      {latestBill ? (
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onViewInvoice(latestBill)}
                            className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Invoice
                          </button>
                          <button
                            type="button"
                            onClick={() => onRecordPayment(latestBill)}
                            className="px-2.5 py-1 rounded-lg bg-[#2C332B] hover:bg-[#1E231D] text-white font-semibold transition-colors cursor-pointer whitespace-nowrap"
                          >
                            {row.status === 'PAID' ? 'Payment' : 'Pay'}
                          </button>
                          {hasProof && latestBill.paymentProof?.dataUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                onViewProof(
                                  latestBill.paymentProof!.dataUrl!,
                                  `${latestBill.unit} - ${latestBill.billingPeriod} Payment Receipt`
                                )
                              }
                              aria-label={`View proof for ${row.unit}`}
                              title="View Proof of Payment"
                              className="p-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenNewBill(row.unit)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-stone-900 font-bold transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Create Bill</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Table Totals Footer */}
            {report.billCount > 0 && (
              <tfoot>
                <tr className="bg-stone-100/90 border-t-2 border-stone-200 font-bold text-[#2C332B]">
                  <td className="py-3 px-4">
                    TOTAL ({report.unitsBilledCount} of {report.totalUnitsCount} units billed)
                  </td>
                  <td className="py-3 px-3 text-right">
                    {formatKwh(report.totalConsumptionKwh)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <CurrencyText amount={report.totalElectricityBilled} />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <CurrencyText amount={report.totalRentAndOtherBilled} />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <CurrencyText amount={report.totalBilled} />
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-800">
                    <CurrencyText amount={report.totalCollected} />
                  </td>
                  <td className="py-3 px-3 text-right text-rose-800">
                    <CurrencyText amount={report.totalRemaining} />
                  </td>
                  <td className="py-3 px-3">
                    {report.collectionRate.toFixed(1)}% Collected
                  </td>
                  <td className="py-3 px-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
