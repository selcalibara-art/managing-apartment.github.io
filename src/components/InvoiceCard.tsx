import React, { useRef, useState } from 'react';
import { toPng, toBlob } from 'html-to-image';
import {
  Download,
  Share2,
  Check,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Eye,
  CreditCard,
} from 'lucide-react';
import {
  Bill,
  formatReading,
  formatKwh,
  formatWholeCurrency,
  DEFAULT_PROPERTY_ADDRESS,
  getAmountPaid,
  getRemainingBalance,
  getBillPaymentStatus,
  hasPaymentProofDetails,
  getRoundedTotalDue,
} from '../utils/billing';
import { CurrencyText } from './CurrencyText';

interface InvoiceCardProps {
  bill: Bill;
  unitAddress?: string;
  showPaidWatermarkDefault?: boolean;
  onMarkAsPaid?: () => void;
  onViewReceiptFull?: (url: string, title: string) => void;
}

export const InvoiceCard: React.FC<InvoiceCardProps> = ({
  bill,
  unitAddress,
  showPaidWatermarkDefault = false,
  onMarkAsPaid,
  onViewReceiptFull,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const roundedTotalDue = getRoundedTotalDue(bill);
  const paymentStatus = getBillPaymentStatus(bill);
  const amountPaid = getAmountPaid(bill);
  const remainingBalance = getRemainingBalance(bill);
  const hasProof = hasPaymentProofDetails(bill);

  const [showPaidWatermark, setShowPaidWatermark] = useState(
    paymentStatus === 'PAID' || paymentStatus === 'PARTIAL' || showPaidWatermarkDefault
  );
  const [copiedLink, setCopiedLink] = useState(false);

  // Download high-resolution PNG using html-to-image (handles modern CSS & oklch flawlessly)
  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    try {
      setIsExporting(true);
      await new Promise((r) => setTimeout(r, 100));

      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2, // 2x crispness
        backgroundColor: '#F7F5F0',
        cacheBust: true,
      });

      const filename = `Calibara_Invoice_${bill.unit.replace(/\s+/g, '_')}_${bill.billingPeriod
        .replace(/[^a-zA-Z0-9]/g, '_')
        .slice(0, 20)}.png`;

      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Error generating invoice image:', err);
      try {
        if (cardRef.current) {
          const fallbackDataUrl = await toPng(cardRef.current, {
            pixelRatio: 1.5,
            backgroundColor: '#F7F5F0',
          });
          setPreviewImageUrl(fallbackDataUrl);
        }
      } catch {
        alert('Could not generate image automatically. You can use the "Share" button or take a screenshot.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  // Web Share API for mobile phones (Messenger, Photos, AirDrop, etc.)
  const handleShareMobile = async () => {
    if (!cardRef.current) return;
    try {
      setIsExporting(true);
      await new Promise((r) => setTimeout(r, 100));

      const blob = await toBlob(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: '#F7F5F0',
        cacheBust: true,
      });

      setIsExporting(false);
      if (!blob) return;

      const filename = `Calibara_Invoice_${bill.unit.replace(/\s+/g, '_')}.png`;
      const file = new File([blob], filename, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Calibara Invoice - ${bill.unit}`,
            text: `Here is the billing statement for ${bill.unit} (${bill.billingPeriod}). Total Amount Due: ${formatWholeCurrency(roundedTotalDue)}.`,
          });
        } catch (shareErr) {
          console.log('Share dismissed', shareErr);
        }
      } else if (navigator.share) {
        try {
          await navigator.share({
            title: `Calibara Invoice - ${bill.unit}`,
            text: `Calibara Apartment ${bill.unit} Invoice for ${bill.billingPeriod}. Total Amount Due: ${formatWholeCurrency(roundedTotalDue)}.`,
          });
        } catch {}
      } else {
        const textSummary = `CALIBARA APARTMENT INVOICE\nUnit: ${bill.unit}\nPeriod: ${bill.billingPeriod}\nTotal Consumption: ${formatKwh(bill.consumptionKwh)}\nTotal Electricity: ₱${bill.electricityTotal.toFixed(2)}\nTOTAL AMOUNT DUE: ${formatWholeCurrency(roundedTotalDue)}${
          paymentStatus === 'PARTIAL'
            ? `\nAmount Paid: ₱${amountPaid.toFixed(2)}\nRemaining Balance: ${formatWholeCurrency(remainingBalance)}`
            : ''
        }`;
        await navigator.clipboard.writeText(textSummary);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      }
    } catch (err) {
      console.error('Share error:', err);
      setIsExporting(false);
    }
  };

  const displayAddress = bill.propertyAddress || unitAddress || DEFAULT_PROPERTY_ADDRESS;

  return (
    <div className="flex flex-col items-center w-full">
      {/* Top Controls Bar for Invoice */}
      <div className="w-full max-w-[440px] mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-stone-700 bg-white px-3 py-1.5 rounded-full border border-stone-200 shadow-2xs hover:bg-stone-50 transition-colors">
          <input
            type="checkbox"
            checked={showPaidWatermark}
            onChange={(e) => setShowPaidWatermark(e.target.checked)}
            className="w-3.5 h-3.5 rounded text-emerald-700 focus:ring-emerald-600 accent-emerald-700 cursor-pointer"
          />
          <span>
            {paymentStatus === 'PARTIAL' ? 'Show PARTIAL Stamp' : 'Show PAID Stamp'}
          </span>
        </label>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShareMobile}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-200 text-stone-800 hover:bg-stone-300 transition-colors shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
            title="Share to Messenger, Photos, or Copy Text"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadImage}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2C332B] text-white hover:bg-[#1E231D] transition-colors shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
            title="Save high resolution PNG image of this invoice"
          >
            {downloadSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
                <span>{isExporting ? 'Generating...' : 'Save PNG (2x)'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* EXACT INVOICE CARD (MATCHING REFERENCE IMAGE) */}
      <div
        ref={cardRef}
        id={`invoice-render-${bill.id}`}
        className="invoice-card-capture relative w-full max-w-[420px] px-5 py-6 sm:px-7 sm:py-7 shadow-lg rounded-none sm:rounded-sm border border-[#E0DBD0] transition-all text-[#2C332B]"
        style={{
          backgroundColor: '#F7F5F0',
          color: '#2C332B',
        }}
      >
        {/* Optional PAID or PARTIAL Stamp Watermark Overlay */}
        {showPaidWatermark && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20 select-none opacity-85 rotate-[-15deg]">
            {paymentStatus === 'PARTIAL' ? (
              <div className="border-[3.5px] border-amber-700/85 rounded-xl px-5 py-2 bg-amber-50/90 backdrop-blur-2xs flex flex-col items-center shadow-lg">
                <span className="text-2xl sm:text-3xl font-extrabold tracking-widest text-amber-800 font-sans">
                  PARTIAL PAID
                </span>
                <span className="text-[11px] font-bold text-amber-900 mt-0.5">
                  PAID: ₱{amountPaid.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(amountPaid) ? 0 : 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] font-bold text-rose-800">
                  BAL DUE: {formatWholeCurrency(remainingBalance)}
                </span>
              </div>
            ) : (
              <div className="border-[3.5px] border-emerald-800/80 rounded-xl px-6 py-2 bg-emerald-50/80 backdrop-blur-2xs flex flex-col items-center shadow-lg">
                <span className="text-3xl sm:text-4xl font-extrabold tracking-widest text-emerald-800 font-sans">
                  PAID
                </span>
                {bill.paymentProof?.datePaid && (
                  <span className="text-[11px] font-semibold text-emerald-700 tracking-wider uppercase mt-0.5">
                    {bill.paymentProof.datePaid}
                  </span>
                )}
                {bill.paymentProof?.referenceNo && (
                  <span className="text-[9px] text-emerald-900 font-mono">
                    REF: {bill.paymentProof.referenceNo}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* 1. Header Minimalist Line-Art Building Illustration */}
        <div className="flex justify-center mb-2.5">
          <svg
            className="w-12 h-12 text-[#2C332B]"
            viewBox="0 0 48 48"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Pitched Roof with overhang */}
            <path d="M6 20L24 6L42 20" />
            <path d="M10 17V10H14V14" />
            {/* Gable Attic Windows (3 triangles/squares) */}
            <rect x="22" y="11" width="4" height="4" />
            <rect x="17" y="15" width="3.5" height="3.5" />
            <rect x="27.5" y="15" width="3.5" height="3.5" />
            {/* Building Main Frame */}
            <rect x="10" y="20" width="28" height="22" />
            {/* Floor dividing horizontal line */}
            <line x1="10" y1="31" x2="38" y2="31" />
            {/* 2nd floor windows */}
            <rect x="14" y="23" width="5" height="5" />
            <line x1="16.5" y1="23" x2="16.5" y2="28" />
            <line x1="14" y1="25.5" x2="19" y2="25.5" />

            <rect x="29" y="23" width="5" height="5" />
            <line x1="31.5" y1="23" x2="31.5" y2="28" />
            <line x1="29" y1="25.5" x2="34" y2="25.5" />

            {/* 1st floor window and door */}
            <rect x="14" y="34" width="5" height="5" />
            <line x1="16.5" y1="34" x2="16.5" y2="39" />
            <line x1="14" y1="36.5" x2="19" y2="36.5" />

            <rect x="29" y="34" width="5" height="5" />
            <line x1="31.5" y1="34" x2="31.5" y2="39" />
            <line x1="29" y1="36.5" x2="34" y2="36.5" />

            <rect x="22" y="33" width="4" height="9" />
            <circle cx="24.5" cy="37.5" r="0.5" fill="currentColor" />
          </svg>
        </div>

        {/* 2. CALIBARA APARTMENT Title */}
        <div className="text-center">
          <h1 className="font-serif-invoice text-xl sm:text-[25px] font-semibold tracking-[0.24em] uppercase text-[#2C332B] leading-tight">
            CALIBARA
          </h1>
          <h2 className="font-serif-invoice text-lg sm:text-[21px] font-semibold tracking-[0.28em] uppercase text-[#2C332B] mt-0.5 leading-tight">
            APARTMENT
          </h2>
          <p className="font-sans-invoice text-[9px] sm:text-[9.5px] tracking-[0.22em] font-medium text-[#2C332B] uppercase mt-2">
            ADDRESS: {displayAddress}
          </p>
        </div>

        {/* Thin Divider Line */}
        <div className="w-full h-[1px] bg-[#2C332B] my-3 opacity-75" />

        {/* 3. INVOICE Heading */}
        <div className="text-center">
          <h3 className="font-serif-invoice text-xl sm:text-[25px] font-semibold tracking-[0.38em] uppercase text-[#2C332B]">
            INVOICE
          </h3>

          {/* Billing Period flanked by Botanical Leaves */}
          <div className="flex items-center justify-center gap-2 mt-1 mb-2.5">
            {/* Left Leaf SVG */}
            <svg
              className="w-3.5 h-3.5 text-[#435245] rotate-[-15deg]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z" />
            </svg>

            <span className="font-script-invoice text-lg sm:text-xl font-bold text-[#2C332B] tracking-wide">
              {bill.billingPeriod || 'Current Billing Period'}
            </span>

            {/* Right Leaf SVG (mirrored) */}
            <svg
              className="w-3.5 h-3.5 text-[#435245] scale-x-[-1] rotate-[-15deg]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z" />
            </svg>
          </div>

          {/* Dark Charcoal Pill Badge for Unit */}
          <div className="inline-block bg-[#2C332B] text-white px-6 py-1 rounded-full text-xs sm:text-[13px] font-bold tracking-[0.16em] uppercase shadow-2xs mb-3">
            {bill.unit}
          </div>
        </div>

        {/* 4. EXACT TABLE STRUCTURE (DESCRIPTION | AMOUNT) */}
        <div className="w-full border border-[#D5D0C2] overflow-hidden text-[#2C332B]">
          {/* Table Header: Dark Olive-Charcoal */}
          <div className="bg-[#2C332B] text-white flex justify-between items-center px-3.5 py-2 text-[10px] sm:text-[11px] font-bold tracking-[0.18em]">
            <span className="uppercase">DESCRIPTION</span>
            <span className="uppercase">AMOUNT</span>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-[#D5D0C2] text-xs font-sans-invoice">
            {/* 1. Last Electricity Submeter Reading */}
            <div className="flex justify-between items-center px-3.5 py-1.5 bg-[#EFECE6]">
              <span className="font-medium text-[#2C332B]">Last Electricity Submeter Reading</span>
              <span className="font-semibold text-[#2C332B]">{formatReading(bill.lastReading)}</span>
            </div>

            {/* 2. Current Reading */}
            <div className="flex justify-between items-center px-3.5 py-1.5 bg-[#EFECE6]">
              <span className="font-medium text-[#2C332B]">Current Reading</span>
              <span className="font-semibold text-[#2C332B]">{formatReading(bill.currentReading)}</span>
            </div>

            {/* 3. Total Consumption */}
            <div className="flex justify-between items-center px-3.5 py-1.5 bg-[#EFECE6]">
              <span className="font-medium text-[#2C332B]">Total Consumption</span>
              <span className="font-semibold text-[#2C332B]">{formatKwh(bill.consumptionKwh)}</span>
            </div>

            {/* 4. Per kWh */}
            <div className="flex justify-between items-center px-3.5 py-1.5 bg-[#EFECE6]">
              <span className="font-medium text-[#2C332B]">Per kWh</span>
              <span className="font-semibold text-[#2C332B]">
                <CurrencyText amount={bill.ratePerKwh} />
              </span>
            </div>

            {/* 5. Dynamic Rent / Additional items (matching reference) */}
            {bill.rentItems && bill.rentItems.length > 0 ? (
              bill.rentItems.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center px-3.5 py-1.5 bg-[#EFECE6]"
                >
                  <span className="font-medium text-[#2C332B]">{item.description}</span>
                  <span className="font-semibold text-[#2C332B]">
                    <CurrencyText amount={item.amount} />
                  </span>
                </div>
              ))
            ) : null}

            {/* 6. Subtotal Row Fill: "Total Electricity Bill" (Medium Warm Stone #DFDDD4) */}
            <div className="flex justify-between items-center px-3.5 py-2 bg-[#DFDDD4] font-semibold text-[#2C332B]">
              <span className="font-semibold">Total Electricity Bill</span>
              <span className="font-bold">
                <CurrencyText amount={bill.electricityTotal} />
              </span>
            </div>

            {/* 7. Grand Total Row Fill: "TOTAL AMOUNT DUE" (Warm Greige/Tan #CCC8B8) - Always rounded up with no decimals */}
            <div className="flex justify-between items-center px-3.5 py-2.5 bg-[#CCC8B8] text-[#2C332B] font-heading-invoice">
              <span className="text-xs sm:text-[13px] font-bold tracking-[0.14em] uppercase">
                TOTAL AMOUNT DUE
              </span>
              <span
                className="text-sm sm:text-base font-extrabold tracking-tight"
                data-testid="invoice-total-amount-due"
              >
                <CurrencyText amount={roundedTotalDue} roundUp noDecimals />
              </span>
            </div>

            {/* 8. Partial Payment Breakdown Rows (if tenant paid partially) */}
            {paymentStatus === 'PARTIAL' && amountPaid > 0 && (
              <>
                <div className="flex justify-between items-center px-3.5 py-2 bg-[#E8E4DA] text-emerald-900 font-semibold">
                  <span>
                    Less: Amount Paid ({bill.paymentProof?.paymentMethod || 'Partial'})
                  </span>
                  <span className="font-bold">
                    - <CurrencyText amount={amountPaid} noDecimals={Number.isInteger(amountPaid)} />
                  </span>
                </div>
                <div className="flex justify-between items-center px-3.5 py-2.5 bg-[#2C332B] text-amber-200 font-heading-invoice">
                  <span className="text-xs font-bold tracking-[0.12em] uppercase">
                    REMAINING BALANCE DUE
                  </span>
                  <span className="text-sm sm:text-base font-extrabold tracking-tight">
                    <CurrencyText amount={remainingBalance} roundUp noDecimals />
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 5. Footer Layout */}
        <div className="mt-3.5 text-center">
          <div className="w-full h-[1px] bg-[#2C332B] opacity-75 mb-2.5" />
          <p className="font-script-invoice text-base sm:text-lg font-bold text-[#2C332B]">
            Thank you for your prompt payment.
          </p>
          <div className="flex items-center justify-center my-0.5">
            <span className="text-[#2C332B] text-xs">♥</span>
          </div>
          <p className="font-serif-invoice text-[11px] sm:text-xs tracking-[0.25em] font-medium uppercase text-[#2C332B]">
            CALIBARA APARTMENT
          </p>
        </div>
      </div>

      {/* Attached Proof of Payment & Record Card (Shown below Invoice when viewing) */}
      {(hasProof || onMarkAsPaid) && (
        <div className="w-full max-w-[420px] mt-4 bg-white rounded-xl border border-stone-200 p-4 shadow-xs text-xs">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              {paymentStatus === 'PAID' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : paymentStatus === 'PARTIAL' ? (
                <Clock className="w-4 h-4 text-amber-600" />
              ) : (
                <CreditCard className="w-4 h-4 text-stone-500" />
              )}
              <span className="font-bold uppercase tracking-wider text-stone-800">
                {paymentStatus === 'PAID'
                  ? 'Paid in Full • Proof of Payment'
                  : paymentStatus === 'PARTIAL'
                  ? 'Partial Payment Recorded'
                  : 'No Payment Recorded Yet'}
              </span>
            </div>
            {onMarkAsPaid && (
              <button
                type="button"
                onClick={onMarkAsPaid}
                className="px-2.5 py-1 rounded-lg bg-[#2C332B] text-white font-semibold hover:bg-[#1E231D] cursor-pointer text-[11px]"
              >
                {hasProof ? 'Update Payment / Proof' : 'Record Payment'}
              </button>
            )}
          </div>

          {hasProof ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2 bg-stone-50 p-2.5 rounded-lg border border-stone-200">
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
                    Remaining Balance
                  </span>
                  <span
                    className={`text-sm font-extrabold ${
                      remainingBalance > 0 ? 'text-rose-700' : 'text-stone-600'
                    }`}
                  >
                    <CurrencyText amount={remainingBalance} />
                  </span>
                </div>
                {bill.paymentProof?.paymentMethod && (
                  <div>
                    <span className="text-[10px] text-stone-500 uppercase font-bold block">
                      Method & Date
                    </span>
                    <span className="font-semibold text-stone-800">
                      {bill.paymentProof.paymentMethod} • {bill.paymentProof.datePaid || 'N/A'}
                    </span>
                  </div>
                )}
                {bill.paymentProof?.referenceNo && (
                  <div>
                    <span className="text-[10px] text-stone-500 uppercase font-bold block">
                      Reference #
                    </span>
                    <span className="font-mono font-semibold text-stone-800">
                      {bill.paymentProof.referenceNo}
                    </span>
                  </div>
                )}
              </div>

              {bill.paymentProof?.notes && (
                <p className="text-stone-600 bg-stone-50 px-3 py-2 rounded-lg border border-stone-200 italic">
                  "{bill.paymentProof.notes}"
                </p>
              )}

              {bill.paymentProof?.dataUrl && (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    Attached Receipt Screenshot / Photo:
                  </span>
                  <div
                    onClick={() =>
                      onViewReceiptFull?.(
                        bill.paymentProof!.dataUrl!,
                        `${bill.unit} - ${bill.billingPeriod} Payment Receipt`
                      )
                    }
                    className="relative rounded-lg overflow-hidden border border-stone-300 bg-stone-900/5 max-h-60 flex items-center justify-center cursor-pointer group"
                  >
                    <img
                      src={bill.paymentProof.dataUrl}
                      alt="Attached payment receipt"
                      className="max-h-56 w-auto object-contain group-hover:scale-[1.02] transition-transform"
                    />
                    <div className="absolute bottom-2 right-2 bg-[#2C332B]/90 text-white px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 shadow-sm">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Tap to Zoom</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-stone-500 text-[11px]">
              No payment or receipt screenshot attached yet. Click "Record Payment" to log a partial or full payment.
            </p>
          )}
        </div>
      )}

      {/* Mobile/Fallback Preview Image Modal */}
      {previewImageUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-3 bg-[#2C332B] text-white flex justify-between items-center text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-amber-200" />
                <span>Invoice Ready to Save</span>
              </span>
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="text-stone-300 hover:text-white cursor-pointer px-2 py-0.5"
              >
                ✕
              </button>
            </div>
            <div className="p-3 overflow-y-auto flex flex-col items-center">
              <img
                src={previewImageUrl}
                alt="Generated Invoice"
                className="w-full rounded shadow-md border border-stone-200"
              />
              <p className="text-xs text-stone-600 mt-3 text-center">
                👉 <strong>Tap and hold image</strong> to save directly to your phone's Photos / Gallery, or right-click to copy image.
              </p>
            </div>
            <div className="p-3 bg-stone-100 border-t flex justify-end">
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="px-4 py-1.5 bg-[#2C332B] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
