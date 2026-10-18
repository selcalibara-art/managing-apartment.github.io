import React from 'react';
import { X, Download, ZoomIn, ZoomOut, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import {
  Bill,
  getAmountPaid,
  getRemainingBalance,
  getBillPaymentStatus,
  getRoundedTotalDue,
  formatDisplayDate,
} from '../utils/billing';
import { CurrencyText } from './CurrencyText';

interface ReceiptLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  title?: string;
  bill?: Bill | null;
}

export const ReceiptLightbox: React.FC<ReceiptLightboxProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title = 'Payment Receipt Proof',
  bill,
}) => {
  const [zoom, setZoom] = React.useState(1);

  if (!isOpen || (!imageUrl && !bill)) return null;

  const effectiveImageUrl = imageUrl || bill?.paymentProof?.dataUrl;

  const handleDownload = () => {
    if (!effectiveImageUrl) return;
    const link = document.createElement('a');
    link.href = effectiveImageUrl;
    link.download = `Calibara_Payment_Proof_${Date.now()}.jpg`;
    link.click();
  };

  const status = bill ? getBillPaymentStatus(bill) : 'PAID';
  const amountPaid = bill ? getAmountPaid(bill) : 0;
  const remainingBalance = bill ? getRemainingBalance(bill) : 0;
  const totalDue = bill ? getRoundedTotalDue(bill) : 0;

  return (
    <div
      className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-3 sm:p-4 select-none"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Top Bar */}
      <div className="w-full max-w-4xl flex items-center justify-between text-white py-2 px-2 sm:px-3">
        <div className="min-w-0 pr-2">
          <h4 className="text-sm font-semibold truncate text-stone-100">{title}</h4>
          {bill && (
            <p className="text-[11px] text-stone-400 truncate">
              {bill.unit} · {bill.billingPeriod}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {effectiveImageUrl && (
            <>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
                aria-label="Zoom Out"
                className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-stone-800 text-stone-200 hover:bg-stone-700 transition-colors flex items-center justify-center cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
                aria-label="Zoom In"
                className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-stone-800 text-stone-200 hover:bg-stone-700 transition-colors flex items-center justify-center cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleDownload}
                aria-label="Download Receipt Image"
                className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-stone-800 text-stone-200 hover:bg-stone-700 transition-colors flex items-center justify-center cursor-pointer"
                title="Download Image"
              >
                <Download className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              onClose();
            }}
            aria-label="Close proof viewer"
            className="min-h-[40px] px-3 py-2 rounded-xl bg-rose-900/90 text-white hover:bg-rose-800 transition-colors ml-1 cursor-pointer flex items-center gap-1 text-xs font-bold"
            title="Close"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* Center View: Image or Digital Payment Proof Record */}
      <div
        className="flex-1 flex flex-col items-center justify-center w-full overflow-auto p-2 gap-4"
        onClick={() => {
          if (effectiveImageUrl) {
            setZoom((z) => (z > 1 ? 1 : 1.5));
          }
        }}
      >
        {effectiveImageUrl ? (
          <img
            src={effectiveImageUrl}
            alt={title}
            style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s ease-out' }}
            className="max-h-[68vh] max-w-full object-contain rounded-xl shadow-2xl cursor-zoom-in"
          />
        ) : bill ? (
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white text-stone-900 rounded-2xl p-5 shadow-2xl border border-stone-200 flex flex-col gap-3 text-xs tabular-nums"
          >
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#2C332B]" />
                <div>
                  <h5 className="font-bold text-sm text-[#2C332B]">
                    {bill.unit} — Payment Record
                  </h5>
                  <p className="text-[11px] text-stone-500">{bill.billingPeriod}</p>
                </div>
              </div>
              {status === 'PAID' ? (
                <span className="inline-flex items-center gap-1 font-extrabold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>PAID</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-extrabold text-amber-700">
                  <AlertCircle className="w-4 h-4" />
                  <span>PARTIAL</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5 bg-stone-50 p-3.5 rounded-xl border border-stone-200">
              <div>
                <span className="text-[10px] text-stone-500 uppercase font-bold block">
                  Total Billed
                </span>
                <span className="text-sm font-bold text-stone-800">
                  <CurrencyText amount={totalDue} roundUp noDecimals />
                </span>
              </div>
              <div>
                <span className="text-[10px] text-stone-500 uppercase font-bold block">
                  Amount Paid
                </span>
                <span className="text-sm font-extrabold text-emerald-700">
                  <CurrencyText amount={amountPaid} />
                </span>
              </div>
              <div>
                <span className="text-[10px] text-stone-500 uppercase font-bold block">
                  Payment Method
                </span>
                <span className="font-semibold text-stone-800">
                  {bill.paymentProof?.paymentMethod || 'Recorded'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-stone-500 uppercase font-bold block">
                  Date Paid
                </span>
                <span className="font-semibold text-stone-800">
                  {formatDisplayDate(bill.paymentProof?.datePaid) ||
                    formatDisplayDate(bill.updatedAt) ||
                    'Recorded'}
                </span>
              </div>
              {bill.paymentProof?.referenceNo && (
                <div className="col-span-2">
                  <span className="text-[10px] text-stone-500 uppercase font-bold block">
                    Reference Number
                  </span>
                  <span className="font-mono font-bold text-stone-900">
                    {bill.paymentProof.referenceNo}
                  </span>
                </div>
              )}
              {remainingBalance > 0 && (
                <div className="col-span-2 pt-2 border-t border-stone-200 flex justify-between items-center">
                  <span className="font-bold text-rose-700 uppercase">Remaining Balance:</span>
                  <span className="text-sm font-extrabold text-rose-700">
                    <CurrencyText amount={remainingBalance} roundUp noDecimals />
                  </span>
                </div>
              )}
            </div>

            {bill.paymentProof?.notes && (
              <p className="text-stone-600 bg-stone-50 px-3 py-2 rounded-xl border border-stone-200 italic">
                &ldquo;{bill.paymentProof.notes}&rdquo;
              </p>
            )}

            <p className="text-[11px] text-stone-400 text-center">
              Payment verified in Calibara Apartment records (no receipt photo attached).
            </p>
          </div>
        ) : null}
      </div>

      {/* Bottom Summary Strip when viewing an image with bill metadata */}
      {effectiveImageUrl && bill ? (
        <div className="w-full max-w-xl bg-stone-900/95 border border-stone-700 rounded-xl p-3 text-xs text-stone-200 flex flex-wrap items-center justify-between gap-2 tabular-nums">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-amber-300">{bill.unit}</span>
            <span>·</span>
            <span>
              Paid:{' '}
              <strong className="text-emerald-400">
                <CurrencyText amount={amountPaid} />
              </strong>
            </span>
            {bill.paymentProof?.paymentMethod && (
              <>
                <span>·</span>
                <span>{bill.paymentProof.paymentMethod}</span>
              </>
            )}
            {bill.paymentProof?.referenceNo && (
              <>
                <span>·</span>
                <span className="font-mono text-stone-300">
                  Ref: {bill.paymentProof.referenceNo}
                </span>
              </>
            )}
          </div>
          {formatDisplayDate(bill.paymentProof?.datePaid) && (
            <span className="text-[11px] text-stone-400">
              {formatDisplayDate(bill.paymentProof?.datePaid)}
            </span>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-stone-400 py-1">
          Tap image to toggle zoom
        </p>
      )}
    </div>
  );
};
