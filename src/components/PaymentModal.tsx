import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  CheckCircle2,
  Trash2,
  Clock,
  AlertCircle,
  Eye,
  Camera,
} from 'lucide-react';
import {
  Bill,
  PaymentStatus,
  getAmountPaid,
  getBillPaymentStatus,
  getRoundedTotalDue,
} from '../utils/billing';
import { compressImage } from '../utils/imageCompressor';
import { CurrencyText } from './CurrencyText';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: Bill;
  onSavePayment: (updatedBill: Bill) => Promise<void>;
  onViewReceiptFull?: (dataUrl: string, title: string) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  bill,
  onSavePayment,
  onViewReceiptFull,
}) => {
  const roundedTotalDue = getRoundedTotalDue(bill);
  const initialStatus = getBillPaymentStatus(bill);
  const initialPaidAmount = getAmountPaid(bill);

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    initialStatus === 'UNPAID' ? 'PAID' : initialStatus
  );
  const [amountPaidInput, setAmountPaidInput] = useState<string>(
    initialPaidAmount > 0 ? String(initialPaidAmount) : String(roundedTotalDue)
  );
  const [datePaid, setDatePaid] = useState<string>(
    bill.paymentProof?.datePaid || new Date().toISOString().slice(0, 10)
  );
  const [paymentMethod, setPaymentMethod] = useState<
    'GCash' | 'Maya' | 'Bank Transfer' | 'Cash' | 'Other'
  >(bill.paymentProof?.paymentMethod || 'GCash');
  const [referenceNo, setReferenceNo] = useState<string>(bill.paymentProof?.referenceNo || '');
  const [notes, setNotes] = useState<string>(bill.paymentProof?.notes || '');
  const [receiptImage, setReceiptImage] = useState<string | undefined>(bill.paymentProof?.dataUrl);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const numericAmountPaid = Math.max(0, parseFloat(amountPaidInput) || 0);
  const remainingBalance = Math.max(
    0,
    Number((roundedTotalDue - numericAmountPaid).toFixed(2))
  );

  // Dynamically determine effective status based on amount entered vs total due
  const handleAmountChange = (rawVal: string) => {
    setValidationError(null);
    setAmountPaidInput(rawVal);
    if (rawVal.trim() === '') {
      // Keep PARTIAL while user is clearing the field to type their partial amount
      setPaymentStatus('PARTIAL');
      return;
    }
    const num = Math.max(0, parseFloat(rawVal) || 0);
    if (num <= 0) {
      setPaymentStatus('UNPAID');
    } else if (num < roundedTotalDue - 0.009) {
      setPaymentStatus('PARTIAL');
    } else {
      setPaymentStatus('PAID');
    }
  };

  const handleSelectStatus = (newStatus: PaymentStatus) => {
    setValidationError(null);
    setPaymentStatus(newStatus);
    if (newStatus === 'UNPAID') {
      setAmountPaidInput('0');
    } else if (newStatus === 'PAID') {
      setAmountPaidInput(String(roundedTotalDue));
    } else if (newStatus === 'PARTIAL') {
      // If currently full amount or 0, set to half or keep current partial amount and focus input
      if (numericAmountPaid >= roundedTotalDue || numericAmountPaid <= 0) {
        const half = Math.ceil(roundedTotalDue / 2);
        setAmountPaidInput(String(half));
      }
      setTimeout(() => {
        amountInputRef.current?.focus();
        amountInputRef.current?.select();
      }, 50);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setValidationError(null);
      setIsCompressing(true);
      const compressedDataUrl = await compressImage(file, 720, 0.65, 35000);
      setReceiptImage(compressedDataUrl);
      // Never overwrite partial status or partial amount when uploading proof of payment
      if (paymentStatus === 'UNPAID' && numericAmountPaid <= 0 && amountPaidInput.trim() !== '') {
        setPaymentStatus('PAID');
        setAmountPaidInput(String(roundedTotalDue));
      }
    } catch (err) {
      console.error('Error compressing receipt image:', err);
      setValidationError('Failed to process image file. Please try another screenshot or photo.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleRemoveImage = () => {
    setReceiptImage(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (paymentStatus === 'PARTIAL' && numericAmountPaid <= 0) {
      setValidationError('Please enter how much the tenant paid for this partial payment.');
      amountInputRef.current?.focus();
      return;
    }

    try {
      setIsSaving(true);

      const finalAmountPaid =
        paymentStatus === 'UNPAID' ? 0 : Math.max(0, Number(numericAmountPaid.toFixed(2)));

      // Determine final status accurately from the amount paid
      let finalStatus: PaymentStatus = paymentStatus;
      if (finalAmountPaid <= 0 && paymentStatus === 'UNPAID') {
        finalStatus = 'UNPAID';
      } else if (finalAmountPaid > 0 && finalAmountPaid < roundedTotalDue - 0.009) {
        finalStatus = 'PARTIAL';
      } else if (finalAmountPaid >= roundedTotalDue - 0.009 && roundedTotalDue > 0) {
        finalStatus = 'PAID';
      }

      const isPaidInFull = finalStatus === 'PAID';

      // Always preserve paymentProof if there is a receipt image, any amount paid, ref #, or notes
      const shouldKeepProof =
        Boolean(receiptImage) ||
        finalAmountPaid > 0 ||
        Boolean(referenceNo.trim()) ||
        Boolean(notes.trim());

      const updatedBill: Bill = {
        ...bill,
        totalAmountDue: roundedTotalDue,
        isPaid: isPaidInFull,
        paymentStatus: finalStatus,
        paymentProof: shouldKeepProof
          ? {
              dataUrl: receiptImage,
              datePaid,
              paymentMethod,
              referenceNo: referenceNo.trim(),
              amountPaid: finalAmountPaid,
              paymentStatus: finalStatus,
              notes: notes.trim(),
            }
          : undefined,
        updatedAt: new Date().toISOString(),
      };

      await onSavePayment(updatedBill);
      onClose();
    } catch (err) {
      console.error(err);
      setValidationError('Failed to update payment status. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#2C332B] text-white shrink-0">
          <div>
            <span className="text-xs text-amber-200 uppercase tracking-widest font-bold">
              {bill.unit} • {bill.billingPeriod}
            </span>
            <h3 className="font-semibold text-base sm:text-lg">
              Record Payment
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-stone-700/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pinned Live Balance Summary Banner */}
        <div className="px-5 py-2.5 bg-stone-100 border-b border-stone-200 grid grid-cols-3 gap-2 text-center shrink-0">
          <div className="flex flex-col items-center justify-center border-r border-stone-200 pr-2">
            <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">
              Total Bill Due
            </span>
            <span className="text-sm sm:text-base font-extrabold text-stone-900">
              <CurrencyText amount={roundedTotalDue} roundUp noDecimals />
            </span>
          </div>

          <div className="flex flex-col items-center justify-center border-r border-stone-200 px-2">
            <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">
              Amount Paid
            </span>
            <span
              className={`text-sm sm:text-base font-extrabold ${
                numericAmountPaid > 0 && paymentStatus !== 'UNPAID'
                  ? 'text-emerald-700'
                  : 'text-stone-400'
              }`}
            >
              <CurrencyText amount={paymentStatus === 'UNPAID' ? 0 : numericAmountPaid} />
            </span>
          </div>

          <div className="flex flex-col items-center justify-center pl-2">
            <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">
              Balance Left
            </span>
            <span
              className={`text-sm sm:text-base font-extrabold ${
                paymentStatus === 'PAID' || remainingBalance <= 0
                  ? 'text-emerald-700'
                  : 'text-rose-700'
              }`}
            >
              <CurrencyText
                amount={paymentStatus === 'UNPAID' ? bill.totalAmountDue : remainingBalance}
              />
            </span>
          </div>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 flex flex-col gap-3.5 overflow-y-auto flex-1">
          {/* 3-Way Payment Status Selector (UNPAID / PARTIAL / PAID IN FULL) */}
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
              Payment Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSelectStatus('UNPAID')}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border ${
                  paymentStatus === 'UNPAID'
                    ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>UNPAID</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectStatus('PARTIAL')}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border ${
                  paymentStatus === 'PARTIAL'
                    ? 'bg-amber-500 text-stone-950 border-amber-600 shadow-xs'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>PARTIAL</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectStatus('PAID')}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border ${
                  paymentStatus === 'PAID'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>PAID IN FULL</span>
              </button>
            </div>
          </div>

          {/* Amount Received Input */}
          <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider">
                Amount Paid (₱)
              </label>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  paymentStatus === 'PAID'
                    ? 'bg-emerald-100 text-emerald-800'
                    : paymentStatus === 'PARTIAL'
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {paymentStatus === 'PAID' && 'Paid in Full'}
                {paymentStatus === 'PARTIAL' && `Balance: ₱${remainingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                {paymentStatus === 'UNPAID' && 'Unpaid'}
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-500">
                ₱
              </span>
              <input
                ref={amountInputRef}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amountPaidInput}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="w-full text-base font-extrabold pl-8 pr-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#2C332B] bg-white text-stone-900"
              />
            </div>

            {/* Quick Amount Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => handleAmountChange(String(roundedTotalDue))}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
              >
                Full (₱{roundedTotalDue.toLocaleString('en-US')})
              </button>
              <button
                type="button"
                onClick={() =>
                  handleAmountChange(String(Math.ceil(roundedTotalDue / 2)))
                }
                className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 cursor-pointer"
              >
                50% (₱{Math.ceil(roundedTotalDue / 2).toLocaleString('en-US')})
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentStatus('PARTIAL');
                  setAmountPaidInput('');
                  amountInputRef.current?.focus();
                }}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-stone-200 text-stone-800 hover:bg-stone-300 cursor-pointer"
              >
                Custom Amount
              </button>
            </div>
          </div>

          {/* Payment Receipt Image Upload & Preview */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
              Receipt / Proof of Payment
            </label>

            {receiptImage ? (
              <div className="rounded-xl border-2 border-emerald-300 p-2.5 bg-emerald-50/40 flex flex-col gap-2">
                <div className="relative w-full h-36 bg-stone-900/5 rounded-lg overflow-hidden border border-stone-200 flex items-center justify-center">
                  <img
                    src={receiptImage}
                    alt="Payment proof preview"
                    onClick={() =>
                      onViewReceiptFull?.(receiptImage, `${bill.unit} - ${bill.billingPeriod} Payment Receipt`)
                    }
                    className="max-h-full max-w-full object-contain cursor-pointer hover:scale-[1.02] transition-transform"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold">Receipt Attached</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        onViewReceiptFull?.(receiptImage, `${bill.unit} - ${bill.billingPeriod} Payment Receipt`)
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#2C332B] text-white hover:bg-[#1E231D] cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-stone-200 text-stone-800 hover:bg-stone-300 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Replace</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                      title="Remove receipt image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-stone-300 hover:border-[#2C332B] rounded-xl p-4 text-center bg-stone-50 hover:bg-stone-100 transition-colors cursor-pointer flex flex-col items-center justify-center gap-1"
              >
                <Upload className="w-5 h-5 text-stone-500" />
                <span className="text-xs font-bold text-stone-700">
                  {isCompressing ? 'Processing image...' : 'Upload Receipt Image'}
                </span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>

          {/* Date Paid, Method & Reference # */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Date Paid</label>
              <input
                type="date"
                value={datePaid}
                onChange={(e) => setDatePaid(e.target.value)}
                className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-[#2C332B] bg-stone-50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e: any) => setPaymentMethod(e.target.value)}
                className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-[#2C332B] bg-stone-50"
              >
                <option value="GCash">GCash</option>
                <option value="Maya">Maya</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                Reference #
              </label>
              <input
                type="text"
                placeholder="Optional"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-[#2C332B] bg-stone-50"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Notes
            </label>
            <textarea
              rows={2}
              placeholder="Optional remarks"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-[#2C332B] bg-stone-50"
            />
          </div>

          {validationError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Pinned Footer buttons */}
          <div className="sticky -bottom-4 sm:-bottom-5 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 px-5 py-3 bg-stone-100 border-t border-stone-200 flex items-center justify-end gap-2 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isCompressing}
              className="px-5 py-2.5 rounded-lg text-xs font-bold bg-[#2C332B] text-white hover:bg-[#1E231D] transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
