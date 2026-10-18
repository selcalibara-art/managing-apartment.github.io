import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateConsumption,
  calculateElectricityTotal,
  calculateTotalDue,
  formatCurrency,
  formatReading,
  formatKwh,
  getPreviousReadingForUnit,
  getAmountPaid,
  getRemainingBalance,
  getBillPaymentStatus,
  hasPaymentProofDetails,
} from './billing.ts';
import type { Bill } from './billing.ts';

test('calculateConsumption calculates difference accurately', () => {
  assert.equal(calculateConsumption(100.5, 50.2), 50.3);
  assert.equal(calculateConsumption(0, 0), 0);
  assert.equal(calculateConsumption(10, 20), 0); // negative clamped to 0
});

test('calculateElectricityTotal multiplies consumption and rate accurately', () => {
  assert.equal(calculateElectricityTotal(10, 15), 150.0);
  assert.equal(calculateElectricityTotal(0, 15), 0.0);
  assert.equal(calculateElectricityTotal(12.5, 15.0), 187.5);
});

test('calculateTotalDue sums electricity and all rent rows', () => {
  const rentItems = [
    { id: '1', description: 'Rent October', amount: 5000 },
    { id: '2', description: 'Water share', amount: 150 },
  ];
  const electricity = 187.5;
  assert.equal(calculateTotalDue(electricity, rentItems), 5337.5);
});

test('formatCurrency formats peso symbol and decimal places', () => {
  assert.equal(formatCurrency(5000), '₱5,000.00');
  assert.equal(formatCurrency(0), '₱0.00');
  assert.equal(formatCurrency(1234.5), '₱1,234.50');
});

test('formatReading and formatKwh format numbers properly', () => {
  assert.equal(formatReading(0), '0.0');
  assert.equal(formatReading(12.4), '12.4');
  assert.equal(formatKwh(15.2), '15.2 kWh');
});

test('getPreviousReadingForUnit returns most recent current reading', () => {
  const dummyBills: Bill[] = [
    {
      id: 'b1',
      unit: 'UNIT S1',
      billingPeriod: 'Sept',
      billingDate: '2026-09-01',
      lastReading: 100,
      currentReading: 150,
      consumptionKwh: 50,
      ratePerKwh: 15,
      electricityTotal: 750,
      rentItems: [{ id: '1', description: 'Rent', amount: 5000 }],
      totalAmountDue: 5750,
      isPaid: true,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
    {
      id: 'b2',
      unit: 'UNIT S1',
      billingPeriod: 'Oct',
      billingDate: '2026-10-01',
      lastReading: 150,
      currentReading: 210,
      consumptionKwh: 60,
      ratePerKwh: 15,
      electricityTotal: 900,
      rentItems: [{ id: '1', description: 'Rent', amount: 5000 }],
      totalAmountDue: 5900,
      isPaid: false,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
  ];

  assert.equal(getPreviousReadingForUnit(dummyBills, 'UNIT S1'), 210);
  assert.equal(getPreviousReadingForUnit(dummyBills, 'UNIT A1'), null);
});

test('partial payment helpers accurately compute paid, remaining, and PARTIAL status', () => {
  const partialBill: Bill = {
    id: 'b-partial',
    unit: 'UNIT A1',
    billingPeriod: 'October',
    billingDate: '2026-10-17',
    lastReading: 10,
    currentReading: 30,
    consumptionKwh: 20,
    ratePerKwh: 15,
    electricityTotal: 300,
    rentItems: [{ id: '1', description: 'Rent', amount: 4500 }],
    totalAmountDue: 4800,
    isPaid: false,
    paymentStatus: 'PARTIAL',
    paymentProof: {
      amountPaid: 2000,
      datePaid: '2026-10-17',
      paymentMethod: 'GCash',
      referenceNo: '998877',
      dataUrl: 'data:image/jpeg;base64,abc123',
    },
    createdAt: '2026-10-17T00:00:00.000Z',
    updatedAt: '2026-10-17T00:00:00.000Z',
  };

  assert.equal(getAmountPaid(partialBill), 2000);
  assert.equal(getRemainingBalance(partialBill), 2800);
  assert.equal(getBillPaymentStatus(partialBill), 'PARTIAL');
  assert.equal(hasPaymentProofDetails(partialBill), true);

  const fullBill: Bill = {
    ...partialBill,
    isPaid: true,
    paymentStatus: 'PAID',
    paymentProof: {
      ...partialBill.paymentProof,
      amountPaid: 4800,
    },
  };
  assert.equal(getAmountPaid(fullBill), 4800);
  assert.equal(getRemainingBalance(fullBill), 0);
  assert.equal(getBillPaymentStatus(fullBill), 'PAID');

  const unpaidBill: Bill = {
    ...partialBill,
    isPaid: false,
    paymentStatus: 'UNPAID',
    paymentProof: undefined,
  };
  assert.equal(getAmountPaid(unpaidBill), 0);
  assert.equal(getRemainingBalance(unpaidBill), 4800);
  assert.equal(getBillPaymentStatus(unpaidBill), 'UNPAID');
  assert.equal(hasPaymentProofDetails(unpaidBill), false);
});
