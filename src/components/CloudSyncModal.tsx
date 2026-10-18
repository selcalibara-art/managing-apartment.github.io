import React, { useState } from 'react';
import { X, Cloud, RefreshCw, Check, Copy, AlertCircle, Database, Download, Upload, ShieldCheck } from 'lucide-react';
import {
  getStoredApiUrl,
  setStoredApiUrl,
  DEFAULT_GAS_URL,
  SAMPLE_GOOGLE_APPS_SCRIPT_CODE,
  SyncState,
} from '../services/cloudStorage';
import { Bill, ApartmentUnit, UnitInfo } from '../utils/billing';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncState: SyncState;
  lastSyncTime: string | null;
  onTriggerSync: () => Promise<void>;
  bills: Bill[];
  unitInfoMap: Record<ApartmentUnit, UnitInfo>;
  onImportBackup: (importedBills: Bill[], importedUnitInfo?: Record<ApartmentUnit, UnitInfo>) => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  syncState,
  lastSyncTime,
  onTriggerSync,
  bills,
  unitInfoMap,
  onImportBackup,
}) => {
  const [apiUrl, setApiUrl] = useState<string>(getStoredApiUrl());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showCodeSnippet, setShowCodeSnippet] = useState(false);

  if (!isOpen) return null;

  const handleSaveUrl = () => {
    setStoredApiUrl(apiUrl);
    setTestResult({ success: true, message: 'Cloud URL updated and saved!' });
    setTimeout(() => setTestResult(null), 3000);
  };

  const handleResetDefaultUrl = () => {
    setApiUrl(DEFAULT_GAS_URL);
    setStoredApiUrl(DEFAULT_GAS_URL);
    setTestResult({ success: true, message: 'Reset to default Google Apps Script Web App URL!' });
    setTimeout(() => setTestResult(null), 3000);
  };

  const handleTestConnection = async () => {
    try {
      setIsTesting(true);
      setTestResult(null);
      setStoredApiUrl(apiUrl);

      const fetchUrl = `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}_test=${Date.now()}`;
      const res = await fetch(fetchUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        setTestResult({
          success: true,
          message: 'Connection Successful! Google Apps Script Web App is live and responding.',
        });
      } else {
        setTestResult({
          success: false,
          message: `Received HTTP error status: ${res.status}. Check Apps Script permissions ("Who has access: Anyone").`,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Connection failed: ${err.message || 'Network/CORS error'}. Ensure the script is deployed as Web App with Anyone access.`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyAppsScript = async () => {
    try {
      await navigator.clipboard.writeText(SAMPLE_GOOGLE_APPS_SCRIPT_CODE);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportJson = () => {
    const backupData = {
      exportedAt: new Date().toISOString(),
      billsCount: bills.length,
      bills,
      unitInfoMap,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Calibara_Apartment_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed.bills)) {
          onImportBackup(parsed.bills, parsed.unitInfoMap);
          alert(`Successfully imported ${parsed.bills.length} bills from backup!`);
        } else if (Array.isArray(parsed)) {
          onImportBackup(parsed);
          alert(`Successfully imported ${parsed.length} bills from backup!`);
        } else {
          alert('Invalid backup JSON file format.');
        }
      } catch (err) {
        alert('Failed to parse backup JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#2C332B] text-white">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-amber-200" />
            <h3 className="font-semibold text-base sm:text-lg">Live Cloud Sync Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-stone-700/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-5 text-stone-800">
          {/* Current Status Banner */}
          <div className="p-4 rounded-xl border bg-stone-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-3.5 h-3.5 rounded-full ${
                  syncState === 'synced'
                    ? 'bg-emerald-500 ring-4 ring-emerald-100 animate-pulse'
                    : syncState === 'syncing'
                    ? 'bg-amber-500 ring-4 ring-amber-100 animate-spin'
                    : 'bg-stone-400'
                }`}
              />
              <div>
                <span className="text-xs font-bold uppercase tracking-wider block">
                  {syncState === 'synced' && '⚡ Real-time Auto-Sync Active'}
                  {syncState === 'syncing' && '🔄 Auto-Syncing with Google Apps Script...'}
                  {syncState === 'offline' && '⚠️ Offline Cache Active (Will Auto-Sync When Online)'}
                  {syncState === 'error' && '⚠️ Cloud Sync Error (Using Local Cache)'}
                </span>
                <span className="text-[11px] text-stone-500">
                  {lastSyncTime
                    ? `Last auto-sync: ${new Date(lastSyncTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })} • Auto-syncs on every bill, payment, or unit edit`
                    : 'Auto-sync active • Every edit saves to cloud immediately'}
                </span>
              </div>
            </div>

            <button
              onClick={onTriggerSync}
              disabled={syncState === 'syncing'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2C332B] text-white text-xs font-semibold rounded-lg hover:bg-[#1E231D] transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
              <span>Sync Now</span>
            </button>
          </div>

          {/* URL Configuration */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
              Google Apps Script Web App URL (`CLOUD_API_URL`)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 text-xs font-mono px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#2C332B] bg-stone-50"
              />
              <button
                onClick={handleSaveUrl}
                className="px-3 py-2 bg-stone-800 text-white rounded-lg text-xs font-semibold hover:bg-stone-900 transition-colors cursor-pointer"
              >
                Save
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <button
                onClick={handleResetDefaultUrl}
                className="text-[11px] text-stone-500 underline hover:text-stone-800 cursor-pointer"
              >
                Reset to default placeholder URL
              </button>
              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
              >
                {isTesting ? 'Testing...' : 'Test Connection'}
              </button>
            </div>

            {testResult && (
              <div
                className={`mt-2 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {testResult.success ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Google Sheets Setup Instructions & Script */}
          <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 text-xs">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-stone-800 uppercase tracking-wide">
                How to Connect Your Own Google Sheet (Optional)
              </h4>
              <button
                onClick={() => setShowCodeSnippet(!showCodeSnippet)}
                className="text-[11px] text-stone-600 underline font-medium cursor-pointer"
              >
                {showCodeSnippet ? 'Hide Script Code' : 'View & Copy Apps Script Code'}
              </button>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-stone-600 text-[11px] leading-relaxed">
              <li>Create a new spreadsheet at Google Sheets.</li>
              <li>Go to <strong>Extensions &gt; Apps Script</strong>.</li>
              <li>Copy and paste the Apps Script code below.</li>
              <li>
                Click <strong>Deploy &gt; New deployment</strong>, select type <strong>Web app</strong>.
              </li>
              <li>
                Set <em>Execute as:</em> <strong>Me</strong> and <em>Who has access:</em>{' '}
                <strong>Anyone</strong>.
              </li>
              <li>Copy the Web App URL ending in <code>/exec</code> and paste it above!</li>
            </ol>

            {showCodeSnippet && (
              <div className="mt-3">
                <div className="flex items-center justify-between bg-stone-800 text-white px-3 py-1.5 rounded-t-lg">
                  <span className="font-mono text-[10px]">GoogleAppsScript_Calibara.gs</span>
                  <button
                    onClick={handleCopyAppsScript}
                    className="inline-flex items-center gap-1 text-[11px] text-amber-300 hover:text-white cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode ? 'Copied to Clipboard!' : 'Copy Code'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-stone-900 text-stone-200 text-[10px] font-mono rounded-b-lg overflow-x-auto max-h-48">
                  {SAMPLE_GOOGLE_APPS_SCRIPT_CODE}
                </pre>
              </div>
            )}
          </div>

          {/* Local Backup & Restore */}
          <div className="border-t border-stone-200 pt-4 flex flex-col gap-2">
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Landlord Data Ownership (Offline JSON Backup)
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleExportJson}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-medium border border-stone-300 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Backup JSON ({bills.length} bills)</span>
              </button>
              <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-medium border border-stone-300 transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Import Backup JSON</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportJsonFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-stone-100 border-t border-stone-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#2C332B] text-white rounded-lg text-xs font-bold hover:bg-[#1E231D] transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
