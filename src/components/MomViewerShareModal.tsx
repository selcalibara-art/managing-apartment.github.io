import React, { useState } from 'react';
import {
  Smartphone,
  Copy,
  Check,
  Share2,
  Eye,
  ShieldCheck,
  Lock,
  CheckCircle2,
  X,
  ExternalLink,
} from 'lucide-react';
import { buildViewerShareUrl } from '../utils/billing';

interface MomViewerShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnterViewerMode: () => void;
  savedPin: string;
}

const GITHUB_PAGES_MOM_URL =
  'https://selcalibara-art.github.io/managing-apartment.github.io/?view=mom';

export const MomViewerShareModal: React.FC<MomViewerShareModalProps> = ({
  isOpen,
  onClose,
  onEnterViewerMode,
  savedPin,
}) => {
  const [copiedGh, setCopiedGh] = useState(false);
  const [copiedCurrent, setCopiedCurrent] = useState(false);

  if (!isOpen) return null;

  const currentViewerUrl =
    typeof window !== 'undefined'
      ? buildViewerShareUrl(window.location.href)
      : GITHUB_PAGES_MOM_URL;

  const primaryShareUrl =
    typeof window !== 'undefined' && window.location.hostname.includes('github.io')
      ? currentViewerUrl
      : GITHUB_PAGES_MOM_URL;

  const handleCopyUrl = async (url: string, type: 'gh' | 'current') => {
    try {
      await navigator.clipboard.writeText(url);
      if (type === 'gh') {
        setCopiedGh(true);
        setTimeout(() => setCopiedGh(false), 2500);
      } else {
        setCopiedCurrent(true);
        setTimeout(() => setCopiedCurrent(false), 2500);
      }
    } catch {
      // Fallback copy
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      if (type === 'gh') {
        setCopiedGh(true);
        setTimeout(() => setCopiedGh(false), 2500);
      } else {
        setCopiedCurrent(true);
        setTimeout(() => setCopiedCurrent(false), 2500);
      }
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Calibara Apartment - Mom Viewer Portal',
          text: 'Here is the safe Read-Only link to check Calibara Apartment invoices, payment status, and receipts on your cellphone:',
          url: primaryShareUrl,
        });
        return;
      } catch {
        // User cancelled native share
      }
    }
    handleCopyUrl(primaryShareUrl, 'gh');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-stone-200 overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mom-viewer-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#2C332B] text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-amber-200 shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 id="mom-viewer-modal-title" className="font-semibold text-sm sm:text-base">
                Mom / Family Read-Only Cellphone Access
              </h3>
              <p className="text-[11px] text-stone-300">
                Safe view-only mode — impossible to accidentally edit or delete anything
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-stone-300 hover:text-white p-1.5 rounded-lg hover:bg-stone-700/50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 text-xs text-stone-700">
          {/* Shareable Link Box */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-stone-900 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-[#2C332B]" />
                <span>Mom&apos;s Direct Cellphone Link (GitHub Pages)</span>
              </span>
              <span className="text-[11px] font-semibold text-emerald-700">Auto Read-Only</span>
            </div>

            <p className="text-[11px] text-stone-500 leading-relaxed">
              Send this link to your mom on Messenger, Viber, or SMS. Because it ends with{' '}
              <code className="font-mono font-bold text-stone-800 bg-stone-200/70 px-1 py-0.5 rounded">
                ?view=mom
              </code>
              , her cellphone will automatically open in <strong>Safe Read-Only Mode</strong>.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-1">
              <input
                type="text"
                readOnly
                aria-label="Mom Read-Only Link"
                value={primaryShareUrl}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="flex-1 px-3 py-2.5 rounded-xl bg-white border border-stone-300 font-mono text-[11px] text-stone-800 focus:outline-none"
              />
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyUrl(primaryShareUrl, 'gh')}
                  className="flex-1 sm:flex-initial min-h-[42px] px-3.5 py-2 rounded-xl bg-[#2C332B] hover:bg-[#1E231D] text-white font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {copiedGh ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Copied Link!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </button>
              </div>
            </div>
          </div>

          {/* What Mom Can See vs What is Protected */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col gap-2">
              <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>What Mom Can Check</span>
              </div>
              <ul className="flex flex-col gap-1.5 text-[11px] text-emerald-900">
                <li>· Track which units are Paid, Partial, or Unpaid</li>
                <li>· View &amp; save each unit&apos;s official Invoice</li>
                <li>· View Proof of Payment photos &amp; GCash Ref #</li>
                <li>· Tap Refresh to load newest cloud updates</li>
              </ul>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-100 border border-stone-200 flex flex-col gap-2">
              <div className="font-bold text-stone-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#2C332B] shrink-0" />
                <span>Protected from Accidental Taps</span>
              </div>
              <ul className="flex flex-col gap-1.5 text-[11px] text-stone-600">
                <li>· All Delete, Edit &amp; New Bill buttons hidden</li>
                <li>· Cannot change payment status or amounts</li>
                <li>· Cannot alter unit settings or cloud URL</li>
                <li>
                  · Exiting Read-Only requires your PIN (
                  <span className="font-mono font-bold text-stone-800">{savedPin}</span>)
                </li>
              </ul>
            </div>
          </div>

          {/* Preview / Switch This Device to Mom Mode */}
          <div className="pt-2 border-t border-stone-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={() => {
                onEnterViewerMode();
                onClose();
              }}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#2C332B] hover:bg-[#1E231D] text-white font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Eye className="w-4 h-4 text-amber-300" />
              <span>Switch This Screen to Mom&apos;s View Now</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
