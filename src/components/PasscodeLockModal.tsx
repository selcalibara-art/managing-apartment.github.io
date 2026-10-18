import React, { useState, useEffect } from 'react';
import { Lock, Unlock, KeyRound, Check, Shield } from 'lucide-react';

interface PasscodeLockModalProps {
  isLocked: boolean;
  onUnlock: () => void;
  savedPin: string;
  isPinEnabled: boolean;
  onUpdatePinSettings: (enabled: boolean, newPin: string) => void;
  isOpenSettingsOnly?: boolean;
  onCloseSettings?: () => void;
}

export const PasscodeLockModal: React.FC<PasscodeLockModalProps> = ({
  isLocked,
  onUnlock,
  savedPin,
  isPinEnabled,
  onUpdatePinSettings,
  isOpenSettingsOnly = false,
  onCloseSettings,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Settings tab states
  const [enabledToggle, setEnabledToggle] = useState(isPinEnabled);
  const [newPin, setNewPin] = useState(savedPin);
  const [confirmPin, setConfirmPin] = useState(savedPin);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);

  useEffect(() => {
    setEnabledToggle(isPinEnabled);
    setNewPin(savedPin);
    setConfirmPin(savedPin);
  }, [isPinEnabled, savedPin]);

  // If in pure lock screen mode
  const handleKeypadPress = (num: string) => {
    if (pinInput.length < 4) {
      const next = pinInput + num;
      setPinInput(next);
      setErrorMsg(null);
      if (next.length === 4) {
        if (next === savedPin) {
          setTimeout(() => {
            setPinInput('');
            onUnlock();
          }, 150);
        } else {
          setErrorMsg('Incorrect PIN. Try again.');
          setTimeout(() => setPinInput(''), 600);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleSaveSettings = () => {
    if (enabledToggle) {
      if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        setSettingsNotice('PIN must be exactly 4 digits.');
        return;
      }
      if (newPin !== confirmPin) {
        setSettingsNotice('PINs do not match.');
        return;
      }
    }
    onUpdatePinSettings(enabledToggle, newPin);
    setSettingsNotice('Security settings updated!');
    setTimeout(() => {
      setSettingsNotice(null);
      onCloseSettings?.();
    }, 1200);
  };

  // If opening settings dialog only
  if (isOpenSettingsOnly) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-stone-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 bg-[#2C332B] text-white">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-200" />
              <h3 className="font-semibold text-base">Landlord Passcode Protection</h3>
            </div>
            {onCloseSettings && (
              <button
                onClick={onCloseSettings}
                className="text-stone-300 hover:text-white p-1 rounded cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="p-5 flex flex-col gap-4 text-stone-800">
            <p className="text-xs text-stone-600">
              Protect your Calibara Apartment billing and submeter records from unauthorized changes
              if using a shared family phone or desktop.
            </p>

            <label className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200 cursor-pointer">
              <span className="text-xs font-bold text-stone-800 uppercase tracking-wide">
                Require 4-Digit PIN to Access
              </span>
              <input
                type="checkbox"
                checked={enabledToggle}
                onChange={(e) => setEnabledToggle(e.target.checked)}
                className="w-4 h-4 rounded text-[#2C332B] accent-[#2C332B]"
              />
            </label>

            {enabledToggle && (
              <div className="flex flex-col gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    New 4-Digit Passcode
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center tracking-widest text-lg font-bold p-2 bg-white rounded-lg border border-stone-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Confirm 4-Digit Passcode
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center tracking-widest text-lg font-bold p-2 bg-white rounded-lg border border-stone-300"
                  />
                </div>
              </div>
            )}

            {settingsNotice && (
              <p className="text-xs text-center font-semibold text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                {settingsNotice}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={onCloseSettings}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                className="px-5 py-2 text-xs font-bold bg-[#2C332B] text-white rounded-lg hover:bg-[#1E231D]"
              >
                Save Security Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full Screen PIN Unlock Screen
  if (!isLocked) return null;

  return (
    <div className="fixed inset-0 z-100 bg-[#FAF8F5] flex flex-col items-center justify-center p-4 select-none">
      <div className="w-full max-w-xs flex flex-col items-center">
        {/* Apartment Icon */}
        <div className="w-16 h-16 rounded-2xl bg-[#2C332B] text-amber-100 flex items-center justify-center mb-4 shadow-lg">
          <Lock className="w-8 h-8" />
        </div>

        <h2 className="font-serif-invoice text-2xl font-bold tracking-[0.2em] uppercase text-[#2C332B]">
          CALIBARA APARTMENT
        </h2>
        <p className="text-xs text-stone-500 font-medium tracking-wider uppercase mt-1 mb-6">
          Landlord Private Portal
        </p>

        {/* PIN Dots */}
        <div className="flex gap-4 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                pinInput.length > i
                  ? 'bg-[#2C332B] border-[#2C332B] scale-110'
                  : 'bg-transparent border-stone-300'
              }`}
            />
          ))}
        </div>

        {errorMsg && (
          <p className="text-xs font-semibold text-rose-600 mb-4 animate-shake">
            {errorMsg}
          </p>
        )}

        {/* 10-key numeric keypad for fast mobile/touch & desktop entry */}
        <div className="grid grid-cols-3 gap-3 w-full mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleKeypadPress(num)}
              className="h-14 rounded-2xl bg-white border border-stone-200 text-stone-800 text-xl font-bold hover:bg-stone-100 active:scale-95 shadow-2xs transition-all cursor-pointer flex items-center justify-center"
            >
              {num}
            </button>
          ))}
          <button
            onClick={() => setPinInput('')}
            className="h-14 rounded-2xl bg-stone-100 border border-stone-200 text-stone-600 text-xs font-bold hover:bg-stone-200 active:scale-95 transition-all cursor-pointer flex items-center justify-center uppercase tracking-wider"
          >
            Clear
          </button>
          <button
            onClick={() => handleKeypadPress('0')}
            className="h-14 rounded-2xl bg-white border border-stone-200 text-stone-800 text-xl font-bold hover:bg-stone-100 active:scale-95 shadow-2xs transition-all cursor-pointer flex items-center justify-center"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="h-14 rounded-2xl bg-stone-100 border border-stone-200 text-stone-600 text-xs font-bold hover:bg-stone-200 active:scale-95 transition-all cursor-pointer flex items-center justify-center uppercase tracking-wider"
          >
            ⌫
          </button>
        </div>

        <p className="text-[11px] text-stone-400 text-center">
          Default Passcode: <span className="font-mono font-bold text-stone-600">{savedPin}</span>
        </p>
      </div>
    </div>
  );
};
