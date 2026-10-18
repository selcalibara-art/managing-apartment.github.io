import { Bill, ApartmentUnit, UnitInfo, INITIAL_UNIT_INFO } from '../utils/billing';

export const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycby3-Le2s1KPRGPOu7F64k24eNONenQVbguofmEHoFN312C4MFh1dPk6jKofHWT9Q-e2/exec';

const STORAGE_KEY_API_URL = 'calibara_gas_url';
const STORAGE_KEY_BILLS = 'calibara_bills_cache';
const STORAGE_KEY_UNIT_INFO = 'calibara_unit_info_cache';
const STORAGE_KEY_LAST_SYNC = 'calibara_last_sync_timestamp';

export type SyncState = 'synced' | 'syncing' | 'offline' | 'error';

export function getStoredApiUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_GAS_URL;
  return localStorage.getItem(STORAGE_KEY_API_URL) || DEFAULT_GAS_URL;
}

export function setStoredApiUrl(url: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_API_URL, url.trim());
}

export function getCachedBills(): Bill[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BILLS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse cached bills', e);
    return [];
  }
}

export function setCachedBills(bills: Bill[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_BILLS, JSON.stringify(bills));
  } catch (e) {
    console.error('Failed to save bills to localStorage', e);
  }
}

export function getCachedUnitInfo(): Record<ApartmentUnit, UnitInfo> {
  if (typeof window === 'undefined') return INITIAL_UNIT_INFO;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_UNIT_INFO);
    if (!raw) return INITIAL_UNIT_INFO;
    return { ...INITIAL_UNIT_INFO, ...JSON.parse(raw) };
  } catch (e) {
    console.error('Failed to parse cached unit info', e);
    return INITIAL_UNIT_INFO;
  }
}

export function setCachedUnitInfo(info: Record<ApartmentUnit, UnitInfo>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_UNIT_INFO, JSON.stringify(info));
  } catch (e) {
    console.error('Failed to save unit info to localStorage', e);
  }
}

export function getLastSyncTime(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY_LAST_SYNC);
}

export function setLastSyncTime(timestamp: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_LAST_SYNC, timestamp);
}

/**
 * Fetch all bills and unit info from Google Apps Script Web App
 */
export async function fetchAllFromCloud(): Promise<{
  bills: Bill[];
  unitInfo?: Record<ApartmentUnit, UnitInfo>;
}> {
  const url = getStoredApiUrl();
  if (!url) {
    throw new Error('No Cloud API URL configured');
  }

  // To avoid browser caching on GET request
  const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;

  const response = await fetch(fetchUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Cloud server returned HTTP ${response.status}`);
  }

  const result = await response.json();
  // Support both direct array and wrapped { bills: [...] } or { status: 'success', bills: [...] }
  let bills: Bill[] = [];
  if (Array.isArray(result)) {
    bills = result;
  } else if (result && Array.isArray(result.bills)) {
    bills = result.bills;
  } else if (result && Array.isArray(result.data)) {
    bills = result.data;
  }

  return {
    bills,
    unitInfo: result.unitInfo || undefined,
  };
}

/**
 * Save or update a single bill to Google Apps Script Web App
 * Uses text/plain;charset=utf-8 to bypass CORS preflight failures on Google Apps Script
 */
export async function saveBillToCloud(bill: Bill): Promise<{ success: boolean; message?: string }> {
  const url = getStoredApiUrl();
  if (!url) throw new Error('No Cloud API URL configured');

  const payload = {
    action: 'SAVE_BILL',
    bill,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to save bill to cloud. Status: ${response.status}`);
  }

  try {
    const json = await response.json();
    return { success: json.status === 'success' || json.success === true, message: json.message };
  } catch {
    return { success: true };
  }
}

/**
 * Delete a bill from Google Apps Script Web App
 */
export async function deleteBillFromCloud(billId: string): Promise<{ success: boolean }> {
  const url = getStoredApiUrl();
  if (!url) throw new Error('No Cloud API URL configured');

  const payload = {
    action: 'DELETE_BILL',
    billId,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to delete bill from cloud. Status: ${response.status}`);
  }

  return { success: true };
}

/**
 * Save or update unit information to Google Apps Script Web App
 */
export async function saveUnitInfoToCloud(
  unitInfo: Record<ApartmentUnit, UnitInfo>
): Promise<{ success: boolean; message?: string }> {
  const url = getStoredApiUrl();
  if (!url) throw new Error('No Cloud API URL configured');

  const payload = {
    action: 'SAVE_UNIT_INFO',
    unitInfo,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to save unit info to cloud. Status: ${response.status}`);
  }

  try {
    const json = await response.json();
    return { success: json.status === 'success' || json.success === true, message: json.message };
  } catch {
    return { success: true };
  }
}

/**
 * Ready-to-copy Google Apps Script Code for landlord who wants to host their own spreadsheet
 */
export const SAMPLE_GOOGLE_APPS_SCRIPT_CODE = `/**
 * Calibara Apartment Cloud Backend (Google Apps Script)
 * Paste this into Google Sheets -> Extensions -> Apps Script, then deploy as Web App:
 * Execute as: Me
 * Who has access: Anyone
 */

function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getSheetByName('Bills');
    if (!sheet) {
      sheet = doc.insertSheet('Bills');
      sheet.appendRow(['ID', 'Unit', 'BillingPeriod', 'BillingDate', 'LastReading', 'CurrentReading', 'ConsumptionKwh', 'RatePerKwh', 'ElectricityTotal', 'RentItemsJson', 'TotalAmountDue', 'IsPaid', 'PaymentProofJson', 'CreatedAt', 'UpdatedAt']);
    }
    
    var data = sheet.getDataRange().getValues();
    var bills = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue;
      bills.push({
        id: String(row[0]),
        unit: String(row[1]),
        billingPeriod: String(row[2]),
        billingDate: String(row[3]),
        lastReading: Number(row[4]) || 0,
        currentReading: Number(row[5]) || 0,
        consumptionKwh: Number(row[6]) || 0,
        ratePerKwh: Number(row[7]) || 15,
        electricityTotal: Number(row[8]) || 0,
        rentItems: row[9] ? JSON.parse(row[9]) : [],
        totalAmountDue: Number(row[10]) || 0,
        isPaid: Boolean(row[11]),
        paymentProof: row[12] ? JSON.parse(row[12]) : null,
        createdAt: String(row[13] || ''),
        updatedAt: String(row[14] || '')
      });
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', bills: bills }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var body = JSON.parse(e.postData.contents);
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = doc.getSheetByName('Bills');
    if (!sheet) {
      sheet = doc.insertSheet('Bills');
      sheet.appendRow(['ID', 'Unit', 'BillingPeriod', 'BillingDate', 'LastReading', 'CurrentReading', 'ConsumptionKwh', 'RatePerKwh', 'ElectricityTotal', 'RentItemsJson', 'TotalAmountDue', 'IsPaid', 'PaymentProofJson', 'CreatedAt', 'UpdatedAt']);
    }

    if (body.action === 'SAVE_BILL') {
      var b = body.bill;
      var data = sheet.getDataRange().getValues();
      var foundRow = -1;
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(b.id)) {
          foundRow = i + 1;
          break;
        }
      }

      var rowValues = [
        b.id,
        b.unit,
        b.billingPeriod,
        b.billingDate,
        b.lastReading,
        b.currentReading,
        b.consumptionKwh,
        b.ratePerKwh,
        b.electricityTotal,
        JSON.stringify(b.rentItems || []),
        b.totalAmountDue,
        b.isPaid,
        JSON.stringify(b.paymentProof || null),
        b.createdAt || new Date().toISOString(),
        b.updatedAt || new Date().toISOString()
      ];

      if (foundRow > 0) {
        sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }

      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Bill saved' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (body.action === 'DELETE_BILL') {
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(body.billId)) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Bill deleted' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}`;
