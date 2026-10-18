import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateConsumption,
  calculateElectricityTotal,
  calculateTotalDue,
  roundUpAmount,
  getRoundedTotalDue,
  formatCurrency,
  formatWholeCurrency,
  formatReading,
  formatKwh,
  formatDisplayDate,
  getPreviousReadingForUnit,
  getAmountPaid,
  getRemainingBalance,
  getBillPaymentStatus,
  hasPaymentProofDetails,
  getBillMonthKey,
  formatMonthLabel,
  getAvailableMonths,
  computeMonthlyTrendSeries,
  computeMonthlyReport,
  isViewerModeFromUrl,
  buildViewerShareUrl,
  computeUnitPaymentTracker,
  INITIAL_UNIT_INFO,
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

test('calculateTotalDue sums electricity and all rent rows and always rounds up (no decimals)', () => {
  const rentItems = [
    { id: '1', description: 'Rent October', amount: 5000 },
    { id: '2', description: 'Water share', amount: 150 },
  ];
  // 187.5 + 5150 = 5337.5 -> rounds up to 5338
  assert.equal(calculateTotalDue(187.5, rentItems), 5338);
  // Exact integer stays integer
  assert.equal(calculateTotalDue(150.0, rentItems), 5300);
  // Any decimal (.01) rounds up to next whole peso
  assert.equal(roundUpAmount(5337.01), 5338);
  assert.equal(formatWholeCurrency(5337.25), '₱5,338');
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

test('formatDisplayDate strips (Standard na Oras sa Singapore) and formats clean YYYY-MM-DD', () => {
  assert.equal(
    formatDisplayDate('Sat Oct 17 2026 00:00:00 GMT+0800 (Standard na Oras sa Singapore)'),
    '2026-10-17'
  );
  assert.equal(formatDisplayDate('2026-10-05'), '2026-10-05');
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

test('monthly report and trend helpers aggregate consumption, collection rates, and MoM changes accurately', () => {
  const sampleBills: Bill[] = [
    {
      id: 'sep-s1',
      unit: 'UNIT S1',
      billingPeriod: 'September 2026',
      billingDate: '2026-09-15',
      lastReading: 100,
      currentReading: 140,
      consumptionKwh: 40,
      ratePerKwh: 15,
      electricityTotal: 600,
      rentItems: [{ id: '1', description: 'Monthly Rent', amount: 5000 }],
      totalAmountDue: 5600,
      isPaid: true,
      paymentStatus: 'PAID',
      paymentProof: { amountPaid: 5600, paymentMethod: 'GCash', datePaid: '2026-09-18' },
      createdAt: '2026-09-15T00:00:00.000Z',
      updatedAt: '2026-09-18T00:00:00.000Z',
    },
    {
      id: 'oct-s1',
      unit: 'UNIT S1',
      billingPeriod: 'October 2026',
      billingDate: '2026-10-15',
      lastReading: 140,
      currentReading: 200,
      consumptionKwh: 60,
      ratePerKwh: 15,
      electricityTotal: 900,
      rentItems: [{ id: '1', description: 'Monthly Rent', amount: 5000 }],
      totalAmountDue: 5900,
      isPaid: true,
      paymentStatus: 'PAID',
      paymentProof: { amountPaid: 5900, paymentMethod: 'GCash', datePaid: '2026-10-16' },
      createdAt: '2026-10-15T00:00:00.000Z',
      updatedAt: '2026-10-16T00:00:00.000Z',
    },
    {
      id: 'oct-a1',
      unit: 'UNIT A1',
      billingPeriod: 'October 2026',
      billingDate: '2026-10-16',
      lastReading: 50,
      currentReading: 70,
      consumptionKwh: 20,
      ratePerKwh: 15,
      electricityTotal: 300,
      rentItems: [{ id: '1', description: 'Monthly Rent', amount: 4500 }],
      totalAmountDue: 4800,
      isPaid: false,
      paymentStatus: 'PARTIAL',
      paymentProof: { amountPaid: 2400, paymentMethod: 'Cash', datePaid: '2026-10-17' },
      createdAt: '2026-10-16T00:00:00.000Z',
      updatedAt: '2026-10-17T00:00:00.000Z',
    },
  ];

  assert.equal(getBillMonthKey(sampleBills[0]), '2026-09');
  assert.equal(formatMonthLabel('2026-10'), 'October 2026');

  const months = getAvailableMonths(sampleBills, '2026-10');
  assert.deepEqual(months, ['2026-10', '2026-09']);

  const trends = computeMonthlyTrendSeries(sampleBills);
  assert.equal(trends.length, 2);
  assert.equal(trends[0].monthKey, '2026-09');
  assert.equal(trends[0].totalConsumptionKwh, 40);
  assert.equal(trends[0].collectionRate, 100);
  assert.equal(trends[1].monthKey, '2026-10');
  assert.equal(trends[1].totalConsumptionKwh, 80);
  assert.equal(trends[1].totalBilled, 10700);
  assert.equal(trends[1].totalCollected, 8300);

  const octReport = computeMonthlyReport(sampleBills, '2026-10', INITIAL_UNIT_INFO);
  assert.equal(octReport.billCount, 2);
  assert.equal(octReport.unitsBilledCount, 2);
  assert.equal(octReport.totalConsumptionKwh, 80);
  assert.equal(octReport.avgConsumptionPerBilledUnitKwh, 40);
  assert.equal(octReport.totalElectricityBilled, 1200);
  assert.equal(octReport.totalRentAndOtherBilled, 9500);
  assert.equal(octReport.totalBilled, 10700);
  assert.equal(octReport.totalCollected, 8300);
  assert.equal(octReport.totalRemaining, 2400);
  assert.equal(octReport.collectionRate, 77.6);
  assert.equal(octReport.paidCount, 1);
  assert.equal(octReport.partialCount, 1);
  assert.equal(octReport.unpaidCount, 0);
  assert.equal(octReport.prevMonthKey, '2026-09');
  assert.equal(octReport.consumptionChangePct, 100); // 40 kWh -> 80 kWh = +100%
  assert.equal(octReport.collectionRateDeltaPts, -22.4); // 100% -> 77.6% = -22.4 pts
  assert.deepEqual(octReport.highestConsumingUnit, { unit: 'UNIT S1', kwh: 60 });
});

test('viewer mode URL detection and unit payment tracker helpers work properly', () => {
  assert.equal(isViewerModeFromUrl('?view=mom'), true);
  assert.equal(isViewerModeFromUrl('?mode=viewer'), true);
  assert.equal(isViewerModeFromUrl('?readonly=1'), true);
  assert.equal(isViewerModeFromUrl('', '#mom'), true);
  assert.equal(isViewerModeFromUrl(''), false);

  assert.equal(
    buildViewerShareUrl('https://selcalibara-art.github.io/managing-apartment.github.io/'),
    'https://selcalibara-art.github.io/managing-apartment.github.io/?view=mom'
  );

  const trackerBills: Bill[] = [
    {
      id: 'b-s1',
      unit: 'UNIT S1',
      billingPeriod: 'October 2026',
      billingDate: '2026-10-15',
      lastReading: 140,
      currentReading: 200,
      consumptionKwh: 60,
      ratePerKwh: 15,
      electricityTotal: 900,
      rentItems: [{ id: '1', description: 'Monthly Rent', amount: 5000 }],
      totalAmountDue: 5900,
      isPaid: true,
      paymentStatus: 'PAID',
      paymentProof: {
        amountPaid: 5900,
        paymentMethod: 'GCash',
        datePaid: '2026-10-16',
        referenceNo: 'GC12345',
        dataUrl: 'data:image/jpeg;base64,receipt1',
      },
      createdAt: '2026-10-15T00:00:00.000Z',
      updatedAt: '2026-10-16T00:00:00.000Z',
    },
    {
      id: 'b-a1',
      unit: 'UNIT A1',
      billingPeriod: 'October 2026',
      billingDate: '2026-10-16',
      lastReading: 50,
      currentReading: 70,
      consumptionKwh: 20,
      ratePerKwh: 15,
      electricityTotal: 300,
      rentItems: [{ id: '1', description: 'Monthly Rent', amount: 4500 }],
      totalAmountDue: 4800,
      isPaid: false,
      paymentStatus: 'PARTIAL',
      paymentProof: { amountPaid: 2000, paymentMethod: 'Cash', datePaid: '2026-10-17' },
      createdAt: '2026-10-16T00:00:00.000Z',
      updatedAt: '2026-10-17T00:00:00.000Z',
    },
  ];

  const tracker = computeUnitPaymentTracker(trackerBills, INITIAL_UNIT_INFO, 'ALL');
  const s1 = tracker.find((u) => u.unit === 'UNIT S1')!;
  const a1 = tracker.find((u) => u.unit === 'UNIT A1')!;
  const b = tracker.find((u) => u.unit === 'UNIT B')!;

  assert.equal(s1.status, 'PAID');
  assert.equal(s1.amountPaid, 5900);
  assert.equal(s1.remainingBalance, 0);
  assert.equal(s1.hasProof, true);
  assert.equal(s1.hasReceiptImage, true);
  assert.equal(s1.referenceNo, 'GC12345');

  assert.equal(a1.status, 'PARTIAL');
  assert.equal(a1.amountPaid, 2000);
  assert.equal(a1.remainingBalance, 2800);
  assert.equal(a1.unpaidBillsCount, 1);
  assert.equal(a1.totalUnpaidBalance, 2800);

  assert.equal(b.status, 'NO_BILL');
  assert.equal(b.latestBill, null);
});


