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
 * Calculates total amount due from electricity and all rent/additional rows
 */
export function calculateTotalDue(electricityTotal: number, rentItems: RentChargeItem[]): number {
  const rentSum = rentItems.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
  return Number((electricityTotal + rentSum).toFixed(2));
}

/**
 * Returns the actual amount paid by the tenant for a given bill
 */
export function getAmountPaid(bill: Bill): number {
  if (bill.paymentProof && typeof bill.paymentProof.amountPaid === 'number' && !isNaN(bill.paymentProof.amountPaid)) {
    return Math.max(0, Number(bill.paymentProof.amountPaid.toFixed(2)));
  }
  if (bill.isPaid) {
    return Number((bill.totalAmountDue || 0).toFixed(2));
  }
  return 0;
}

/**
 * Returns the remaining balance still owed on a bill
 */
export function getRemainingBalance(bill: Bill): number {
  const paid = getAmountPaid(bill);
  const remaining = (bill.totalAmountDue || 0) - paid;
  return Math.max(0, Number(remaining.toFixed(2)));
}

/**
 * Determines whether a bill is UNPAID, PARTIAL, or PAID in full
 */
export function getBillPaymentStatus(bill: Bill): PaymentStatus {
  const paid = getAmountPaid(bill);
  const total = bill.totalAmountDue || 0;

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
