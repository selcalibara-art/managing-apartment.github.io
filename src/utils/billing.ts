export interface RentChargeItem {
  id: string;
  description: string;
  amount: number;
}

export type ApartmentUnit = string;

export const DEFAULT_PROPERTY_ADDRESS = 'BATAS, SILANG, CAVITE';

export const INITIAL_APARTMENT_UNITS: string[] = [
  'UNIT A1',
  'UNIT B',
  'UNIT C',
  'UNIT S1',
  'UNIT S2',
];

export const APARTMENT_UNITS = INITIAL_APARTMENT_UNITS;

export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface PaymentProof {
  dataUrl?: string; // compressed base64 image
  datePaid?: string;
  paymentMethod?: 'GCash' | 'Maya' | 'Bank Transfer' | 'Cash' | 'Other';
  referenceNo?: string;
  notes?: string;
  amountPaid?: number;
  paymentStatus?: PaymentStatus;
}

export interface Bill {
  id: string;
  unit: ApartmentUnit;
  propertyAddress?: string; // Optional unit/property specific address (defaults to BATAS, SILANG, CAVITE)
  billingPeriod: string; // e.g. "Current Billing Period October" or "Bill for June - July"
  billingDate: string; // ISO date string YYYY-MM-DD
  lastReading: number;
  currentReading: number;
  consumptionKwh: number;
  ratePerKwh: number;
  electricityTotal: number;
  rentItems: RentChargeItem[];
  totalAmountDue: number;
  isPaid: boolean;
  paymentStatus?: PaymentStatus;
  paymentProof?: PaymentProof;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface UnitInfo {
  unit: ApartmentUnit;
  address?: string; // Unit or property address (e.g. "BATAS, SILANG, CAVITE" or any other branch)
  tenantName: string;
  contactNumber: string;
  defaultMonthlyRent: number;
  notes: string;
}

export const INITIAL_UNIT_INFO: Record<ApartmentUnit, UnitInfo> = {
  'UNIT A1': {
    unit: 'UNIT A1',
    address: DEFAULT_PROPERTY_ADDRESS,
    tenantName: '',
    contactNumber: '',
    defaultMonthlyRent: 4500,
    notes: 'Ground floor unit',
  },
  'UNIT B': {
    unit: 'UNIT B',
    address: DEFAULT_PROPERTY_ADDRESS,
    tenantName: '',
    contactNumber: '',
    defaultMonthlyRent: 4500,
    notes: '',
  },
  'UNIT C': {
    unit: 'UNIT C',
    address: DEFAULT_PROPERTY_ADDRESS,
    tenantName: '',
    contactNumber: '',
    defaultMonthlyRent: 4500,
    notes: '',
  },
  'UNIT S1': {
    unit: 'UNIT S1',
    address: DEFAULT_PROPERTY_ADDRESS,
    tenantName: '',
    contactNumber: '',
    defaultMonthlyRent: 5000,
    notes: 'Studio / Special Unit S1',
  },
  'UNIT S2': {
    unit: 'UNIT S2',
    address: DEFAULT_PROPERTY_ADDRESS,
    tenantName: '',
    contactNumber: '',
    defaultMonthlyRent: 5000,
    notes: 'Studio / Special Unit S2',
  },
};

/**
 * Calculates electricity consumption from readings
 */
export function calculateConsumption(current: number, last: number): number {
  const diff = current - last;
  return Number((diff < 0 ? 0 : diff).toFixed(2));
}

/**
 * Calculates electricity total bill
 */
export function calculateElectricityTotal(consumption: number, ratePerKwh: number): number {
  return Number((Math.max(0, consumption) * Math.max(0, ratePerKwh)).toFixed(2));
}

/**
 * Rounds up a numeric peso amount to the next whole integer (no decimals)
 */
export function roundUpAmount(amount: number): number {
  const safe = isNaN(amount) ? 0 : amount;
  if (safe <= 0) return 0;
  return Math.ceil(Number(safe.toFixed(4)));
}

/**
 * Returns the rounded-up whole integer total amount due for a bill
 */
export function getRoundedTotalDue(bill: Bill): number {
  return roundUpAmount(Number(bill.totalAmountDue) || 0);
}

/**
 * Calculates total amount due from electricity and all rent/additional rows, always rounded up (no decimals)
 */
export function calculateTotalDue(electricityTotal: number, rentItems: RentChargeItem[]): number {
  const rentSum = rentItems.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
  return roundUpAmount(electricityTotal + rentSum);
}

/**
 * Returns the actual amount paid by the tenant for a given bill
 */
export function getAmountPaid(bill: Bill): number {
  if (bill.paymentProof && typeof bill.paymentProof.amountPaid === 'number' && !isNaN(bill.paymentProof.amountPaid)) {
    return Math.max(0, Number(bill.paymentProof.amountPaid.toFixed(2)));
  }
  if (bill.isPaid) {
    return getRoundedTotalDue(bill);
  }
  return 0;
}

/**
 * Returns the remaining balance still owed on a bill
 */
export function getRemainingBalance(bill: Bill): number {
  const paid = getAmountPaid(bill);
  const remaining = getRoundedTotalDue(bill) - paid;
  return Math.max(0, Number(remaining.toFixed(2)));
}

/**
 * Determines whether a bill is UNPAID, PARTIAL, or PAID in full
 */
export function getBillPaymentStatus(bill: Bill): PaymentStatus {
  const paid = getAmountPaid(bill);
  const total = getRoundedTotalDue(bill);

  if (paid > 0 && paid < total - 0.009) {
    return 'PARTIAL';
  }
  if ((paid >= total - 0.009 && total > 0) || (bill.isPaid && paid >= total - 0.009)) {
    return 'PAID';
  }
  if (bill.paymentStatus === 'PARTIAL' && paid > 0) {
    return 'PARTIAL';
  }
  if (bill.isPaid && paid === 0 && total === 0) {
    return 'PAID';
  }
  return 'UNPAID';
}

/**
 * Checks whether a bill has any attached payment proof or recorded payment details
 */
export function hasPaymentProofDetails(bill: Bill): boolean {
  if (!bill.paymentProof) return false;
  return Boolean(
    bill.paymentProof.dataUrl ||
      (typeof bill.paymentProof.amountPaid === 'number' && bill.paymentProof.amountPaid > 0) ||
      bill.paymentProof.referenceNo?.trim() ||
      bill.paymentProof.notes?.trim()
  );
}

/**
 * Currency formatter (Philippine Peso)
 */
export function formatCurrency(amount: number): string {
  const safeAmount = isNaN(amount) ? 0 : amount;
  return `₱${safeAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Whole-peso currency formatter with round-up and no decimals (e.g. ₱5,338)
 */
export function formatWholeCurrency(amount: number): string {
  const rounded = roundUpAmount(amount);
  return `₱${rounded.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/**
 * Reading formatter (#,##0.0)
 */
export function formatReading(reading: number): string {
  const safe = isNaN(reading) ? 0 : reading;
  return safe.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
}

/**
 * Format kWh (#,##0.0 kWh)
 */
export function formatKwh(val: number): string {
  return `${formatReading(val)} kWh`;
}

/**
 * Finds the latest saved reading for a unit to auto-fill last submeter reading
 */
export function getPreviousReadingForUnit(bills: Bill[], unit: ApartmentUnit): number | null {
  const unitBills = bills
    .filter((b) => b.unit === unit)
    .sort((a, b) => new Date(b.billingDate || b.createdAt).getTime() - new Date(a.billingDate || a.createdAt).getTime());

  if (unitBills.length === 0) {
    return null;
  }
  return unitBills[0].currentReading;
}

const SHORT_MONTH_TO_NUM: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

/**
 * Formats any date string cleanly into YYYY-MM-DD (or clean text), stripping verbose
 * JavaScript/Google Sheets Date.toString() timezones like "GMT+0800 (Standard na Oras sa Singapore)"
 * without timezone-offset day shifts.
 */
export function formatDisplayDate(rawDate?: string | null): string {
  if (!rawDate) return '';
  const trimmed = String(rawDate).trim();
  if (!trimmed) return '';

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // ISO string starting with YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  // Match JS/Google Sheets Date.toString(): e.g. "Sat Oct 17 2026 00:00:00 GMT+0800 (Standard na Oras sa Singapore)"
  const jsDateMatch = trimmed.match(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/i
  );
  if (jsDateMatch) {
    const monthNum = SHORT_MONTH_TO_NUM[jsDateMatch[1].slice(0, 3).toLowerCase()];
    const dayNum = String(parseInt(jsDateMatch[2], 10)).padStart(2, '0');
    const yearNum = jsDateMatch[3];
    if (monthNum) {
      return `${yearNum}-${monthNum}-${dayNum}`;
    }
  }

  // Strip parenthetical timezone e.g. "(Standard na Oras sa Singapore)" or "(Singapore Standard Time)" and "GMT+0800..."
  const cleaned = trimmed
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s*GMT[+-]\d{4}.*$/i, '')
    .replace(/\s+\d{2}:\d{2}:\d{2}\b.*$/i, '')
    .trim();

  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return cleaned;
}

/**
 * Extracts canonical YYYY-MM month key from a Bill's billingDate or createdAt
 */
export function getBillMonthKey(bill: Bill): string {
  const cleanBilling = formatDisplayDate(bill.billingDate);
  if (/^\d{4}-\d{2}/.test(cleanBilling)) {
    return cleanBilling.slice(0, 7);
  }
  const cleanCreated = formatDisplayDate(bill.createdAt);
  if (/^\d{4}-\d{2}/.test(cleanCreated)) {
    return cleanCreated.slice(0, 7);
  }
  const parsed = new Date(bill.billingDate || bill.createdAt || Date.now());
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
  return new Date().toISOString().slice(0, 7);
}

const MONTH_NAMES_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_NAMES_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Formats a YYYY-MM key into human-readable label (e.g. "October 2026")
 */
export function formatMonthLabel(monthKey: string): string {
  if (monthKey === 'ALL') return 'All Billing Months';
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  const year = match[1];
  const monthIdx = parseInt(match[2], 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return monthKey;
  return `${MONTH_NAMES_FULL[monthIdx]} ${year}`;
}

/**
 * Formats a YYYY-MM key into short label (e.g. "Oct 2026")
 */
export function formatShortMonthLabel(monthKey: string): string {
  if (monthKey === 'ALL') return 'All Time';
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  const year = match[1];
  const monthIdx = parseInt(match[2], 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return monthKey;
  return `${MONTH_NAMES_SHORT[monthIdx]} ${year}`;
}

/**
 * Returns sorted descending list of YYYY-MM keys from bills plus fallback current month
 */
export function getAvailableMonths(bills: Bill[], fallbackCurrentMonth?: string): string[] {
  const set = new Set<string>();
  bills.forEach((b) => {
    const key = getBillMonthKey(b);
    if (key) set.add(key);
  });
  if (set.size === 0) {
    const def = fallbackCurrentMonth || new Date().toISOString().slice(0, 7);
    set.add(def);
  } else if (fallbackCurrentMonth && /^\d{4}-\d{2}$/.test(fallbackCurrentMonth)) {
    set.add(fallbackCurrentMonth);
  }
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

export interface MonthlyUnitBreakdown {
  unit: ApartmentUnit;
  tenantName: string;
  propertyAddress: string;
  billCount: number;
  bills: Bill[];
  consumptionKwh: number;
  electricityTotal: number;
  rentAndOtherTotal: number;
  totalBilled: number;
  amountPaid: number;
  remainingBalance: number;
  collectionRate: number; // 0 to 100
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'NO_BILL';
}

export interface MonthlyTrendPoint {
  monthKey: string;
  label: string;
  shortLabel: string;
  billCount: number;
  totalConsumptionKwh: number;
  totalElectricityBilled: number;
  totalRentAndOtherBilled: number;
  totalBilled: number;
  totalCollected: number;
  totalRemaining: number;
  collectionRate: number; // 0 to 100
  paidCount: number;
  partialCount: number;
  unpaidCount: number;
}

export interface MonthlyReportSummary {
  monthKey: string; // 'YYYY-MM' or 'ALL'
  monthLabel: string;
  billCount: number;
  unitsBilledCount: number;
  totalUnitsCount: number;
  totalBilled: number;
  totalCollected: number;
  totalRemaining: number;
  collectionRate: number; // 0 to 100
  paidCount: number;
  partialCount: number;
  unpaidCount: number;
  totalConsumptionKwh: number;
  avgConsumptionPerBilledUnitKwh: number;
  averageRatePerKwh: number;
  totalElectricityBilled: number;
  totalRentAndOtherBilled: number;
  highestConsumingUnit: { unit: string; kwh: number } | null;
  prevMonthKey: string | null;
  consumptionChangePct: number | null;
  collectionRateDeltaPts: number | null;
  totalBilledChangePct: number | null;
  unitBreakdowns: MonthlyUnitBreakdown[];
}

/**
 * Computes chronological trend series (oldest -> newest) across all billing months
 */
export function computeMonthlyTrendSeries(bills: Bill[]): MonthlyTrendPoint[] {
  const monthMap = new Map<string, Bill[]>();
  bills.forEach((b) => {
    const key = getBillMonthKey(b);
    const list = monthMap.get(key) || [];
    list.push(b);
    monthMap.set(key, list);
  });

  const sortedKeys = Array.from(monthMap.keys()).sort((a, b) => a.localeCompare(b));

  return sortedKeys.map((monthKey) => {
    const monthBills = monthMap.get(monthKey) || [];
    let totalConsumptionKwh = 0;
    let totalElectricityBilled = 0;
    let totalRentAndOtherBilled = 0;
    let totalBilled = 0;
    let totalCollected = 0;
    let totalRemaining = 0;
    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;

    monthBills.forEach((b) => {
      const kwh = Number(b.consumptionKwh) || 0;
      const elec = Number(b.electricityTotal) || 0;
      const rentSum = (b.rentItems || []).reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
      const due = getRoundedTotalDue(b);
      const paid = getAmountPaid(b);
      const rem = getRemainingBalance(b);
      const st = getBillPaymentStatus(b);

      totalConsumptionKwh += kwh;
      totalElectricityBilled += elec;
      totalRentAndOtherBilled += rentSum;
      totalBilled += due;
      totalCollected += paid;
      totalRemaining += rem;

      if (st === 'PAID') paidCount += 1;
      else if (st === 'PARTIAL') partialCount += 1;
      else unpaidCount += 1;
    });

    const collectionRate =
      totalBilled > 0 ? Number(Math.min(100, (totalCollected / totalBilled) * 100).toFixed(1)) : 0;

    return {
      monthKey,
      label: formatMonthLabel(monthKey),
      shortLabel: formatShortMonthLabel(monthKey),
      billCount: monthBills.length,
      totalConsumptionKwh: Number(totalConsumptionKwh.toFixed(2)),
      totalElectricityBilled: Number(totalElectricityBilled.toFixed(2)),
      totalRentAndOtherBilled: Number(totalRentAndOtherBilled.toFixed(2)),
      totalBilled: Number(totalBilled.toFixed(2)),
      totalCollected: Number(totalCollected.toFixed(2)),
      totalRemaining: Number(totalRemaining.toFixed(2)),
      collectionRate,
      paidCount,
      partialCount,
      unpaidCount,
    };
  });
}

/**
 * Aggregates all billing data for a selected month (or 'ALL') and computes unit breakdowns and MoM trends
 */
export function computeMonthlyReport(
  bills: Bill[],
  monthKey: string,
  unitInfoMap: Record<ApartmentUnit, UnitInfo> = INITIAL_UNIT_INFO
): MonthlyReportSummary {
  const matchingBills =
    monthKey === 'ALL' ? bills : bills.filter((b) => getBillMonthKey(b) === monthKey);

  // Determine all units (configured + any unit present in bills)
  const unitSet = new Set<string>(Object.keys(unitInfoMap));
  matchingBills.forEach((b) => unitSet.add(b.unit));
  const allUnits = Array.from(unitSet);

  let totalBilled = 0;
  let totalCollected = 0;
  let totalRemaining = 0;
  let paidCount = 0;
  let partialCount = 0;
  let unpaidCount = 0;
  let totalConsumptionKwh = 0;
  let totalElectricityBilled = 0;
  let totalRentAndOtherBilled = 0;
  let weightedRateSum = 0;
  let rateCount = 0;

  matchingBills.forEach((b) => {
    const kwh = Number(b.consumptionKwh) || 0;
    const elec = Number(b.electricityTotal) || 0;
    const rentSum = (b.rentItems || []).reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
    const due = getRoundedTotalDue(b);
    const paid = getAmountPaid(b);
    const rem = getRemainingBalance(b);
    const st = getBillPaymentStatus(b);

    totalConsumptionKwh += kwh;
    totalElectricityBilled += elec;
    totalRentAndOtherBilled += rentSum;
    totalBilled += due;
    totalCollected += paid;
    totalRemaining += rem;

    if (b.ratePerKwh > 0) {
      weightedRateSum += Number(b.ratePerKwh);
      rateCount += 1;
    }

    if (st === 'PAID') paidCount += 1;
    else if (st === 'PARTIAL') partialCount += 1;
    else unpaidCount += 1;
  });

  const unitBreakdowns: MonthlyUnitBreakdown[] = allUnits.map((unit) => {
    const uBills = matchingBills.filter((b) => b.unit === unit);
    const uInfo = unitInfoMap[unit];
    const tenantName = uInfo?.tenantName || '';
    const propertyAddress =
      uBills[0]?.propertyAddress || uInfo?.address || DEFAULT_PROPERTY_ADDRESS;

    if (uBills.length === 0) {
      return {
        unit,
        tenantName,
        propertyAddress,
        billCount: 0,
        bills: [],
        consumptionKwh: 0,
        electricityTotal: 0,
        rentAndOtherTotal: 0,
        totalBilled: 0,
        amountPaid: 0,
        remainingBalance: 0,
        collectionRate: 0,
        status: 'NO_BILL',
      };
    }

    let uKwh = 0;
    let uElec = 0;
    let uRent = 0;
    let uBilled = 0;
    let uPaid = 0;
    let uRem = 0;

    uBills.forEach((b) => {
      uKwh += Number(b.consumptionKwh) || 0;
      uElec += Number(b.electricityTotal) || 0;
      uRent += (b.rentItems || []).reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
      uBilled += getRoundedTotalDue(b);
      uPaid += getAmountPaid(b);
      uRem += getRemainingBalance(b);
    });

    const uRate = uBilled > 0 ? Number(Math.min(100, (uPaid / uBilled) * 100).toFixed(1)) : 0;
    let status: 'PAID' | 'PARTIAL' | 'UNPAID' = 'UNPAID';
    if (uRem <= 0.009 && uBilled > 0) {
      status = 'PAID';
    } else if (uPaid > 0) {
      status = 'PARTIAL';
    }

    return {
      unit,
      tenantName,
      propertyAddress,
      billCount: uBills.length,
      bills: uBills,
      consumptionKwh: Number(uKwh.toFixed(2)),
      electricityTotal: Number(uElec.toFixed(2)),
      rentAndOtherTotal: Number(uRent.toFixed(2)),
      totalBilled: Number(uBilled.toFixed(2)),
      amountPaid: Number(uPaid.toFixed(2)),
      remainingBalance: Number(uRem.toFixed(2)),
      collectionRate: uRate,
      status,
    };
  });

  const billedUnits = unitBreakdowns.filter((u) => u.billCount > 0);
  const unitsBilledCount = billedUnits.length;
  const avgConsumptionPerBilledUnitKwh =
    unitsBilledCount > 0 ? Number((totalConsumptionKwh / unitsBilledCount).toFixed(2)) : 0;
  const averageRatePerKwh = rateCount > 0 ? Number((weightedRateSum / rateCount).toFixed(2)) : 0;

  let highestConsumingUnit: { unit: string; kwh: number } | null = null;
  billedUnits.forEach((u) => {
    if (u.consumptionKwh > 0 && (!highestConsumingUnit || u.consumptionKwh > highestConsumingUnit.kwh)) {
      highestConsumingUnit = { unit: u.unit, kwh: u.consumptionKwh };
    }
  });

  const collectionRate =
    totalBilled > 0 ? Number(Math.min(100, (totalCollected / totalBilled) * 100).toFixed(1)) : 0;

  // Month-over-Month comparison against prior active month
  let prevMonthKey: string | null = null;
  let consumptionChangePct: number | null = null;
  let collectionRateDeltaPts: number | null = null;
  let totalBilledChangePct: number | null = null;

  if (monthKey !== 'ALL') {
    const trendSeries = computeMonthlyTrendSeries(bills);
    const idx = trendSeries.findIndex((t) => t.monthKey === monthKey);
    if (idx > 0) {
      const prev = trendSeries[idx - 1];
      prevMonthKey = prev.monthKey;
      if (prev.totalConsumptionKwh > 0) {
        consumptionChangePct = Number(
          (((totalConsumptionKwh - prev.totalConsumptionKwh) / prev.totalConsumptionKwh) * 100).toFixed(1)
        );
      }
      collectionRateDeltaPts = Number((collectionRate - prev.collectionRate).toFixed(1));
      if (prev.totalBilled > 0) {
        totalBilledChangePct = Number(
          (((totalBilled - prev.totalBilled) / prev.totalBilled) * 100).toFixed(1)
        );
      }
    }
  }

  return {
    monthKey,
    monthLabel: formatMonthLabel(monthKey),
    billCount: matchingBills.length,
    unitsBilledCount,
    totalUnitsCount: allUnits.length,
    totalBilled: Number(totalBilled.toFixed(2)),
    totalCollected: Number(totalCollected.toFixed(2)),
    totalRemaining: Number(totalRemaining.toFixed(2)),
    collectionRate,
    paidCount,
    partialCount,
    unpaidCount,
    totalConsumptionKwh: Number(totalConsumptionKwh.toFixed(2)),
    avgConsumptionPerBilledUnitKwh,
    averageRatePerKwh,
    totalElectricityBilled: Number(totalElectricityBilled.toFixed(2)),
    totalRentAndOtherBilled: Number(totalRentAndOtherBilled.toFixed(2)),
    highestConsumingUnit,
    prevMonthKey,
    consumptionChangePct,
    collectionRateDeltaPts,
    totalBilledChangePct,
    unitBreakdowns,
  };
}

