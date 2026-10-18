import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle2, Image as ImageIcon, Trash2, Calendar, CreditCard, Hash, FileText } from 'lucide-react';
import { Bill, formatCurrency } from '../utils/billing';
import { compressImage } from '../utils/imageCompressor';
import { CurrencyText, PesoSymbol } from './CurrencyText';

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
  const [isPaid, setIsPaid] = useState<boolean>(bill.isPaid);
  const [datePaid, setDatePaid] = useState<string>(
    bill.paymentProof?.datePaid || new Date().toISOString().slice(0, 10)
  );
  const [paymentMethod, setPaymentMethod] = useState<
    'GCash' | 'Maya' | 'Bank Transfer' | 'Cash' | 'Other'
  >(bill.paymentProof?.paymentMethod || 'GCash');
  const [referenceNo, setReferenceNo] = useState<string>(bill.paymentProof?.referenceNo || '');
  const [amountPaid, setAmountPaid] = useState<number>(
    bill.paymentProof?.amountPaid ?? bill.totalAmountDue
  );
  const [notes, setNotes] = useState<string>(bill.paymentProof?.notes || '');
  const [receiptImage, setReceiptImage] = useState<string | undefined>(bill.paymentProof?.dataUrl);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      // Automatically compress using HTML5 canvas (max 900px, quality 0.7)
      const compressedDataUrl = await compressImage(file, 900, 0.7);
      setReceiptImage(compressedDataUrl);
      setIsPaid(true); // attaching payment proof automatically marks as paid
    } catch (err) {
      console.error('Error compressing receipt image:', err);
      alert('Failed to process image file. Please try another image.');
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
    try {
      setIsSaving(true);
      const updatedBill: Bill = {
        ...bill,
        isPaid,
        paymentProof: isPaid
          ? {
              dataUrl: receiptImage,
              datePaid,
              paymentMethod,
              referenceNo: referenceNo.trim(),
              amountPaid: Number(amountPaid) || bill.totalAmountDue,
              notes: notes.trim(),
            }
          : undefined,
        updatedAt: new Date().toISOString(),
      };

      await onSavePayment(updatedBill);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to update payment status. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#2C332B] text-white">
          <div>
            <span className="text-xs text-amber-200 uppercase tracking-widest font-bold">
              {bill.unit}
            </span>
            <h3 className="font-semibold text-base sm:text-lg">Payment Tracker & Proof</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-300 hover:text-white hover:bg-stone-700/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {/* Bill summary banner */}
          <div className="flex items-center justify-between p-3.5 bg-stone-100 rounded-xl border border-stone-200">
            <div>
              <p className="text-xs text-stone-500 font-medium">{bill.billingPeriod}</p>
              <p className="text-xs text-stone-600 mt-0.5">Electricity: {bill.consumptionKwh} kWh</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-stone-500 font-bold uppercase block">Amount Due</span>
              <span className="text-base font-bold text-stone-900 font-sans">
                <CurrencyText amount={bill.totalAmountDue} />
              </span>
            </div>
          </div>

          {/* Paid / Unpaid Toggle Switch */}
          <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200">
            <span className="text-xs font-bold text-stone-800 uppercase tracking-wide">
              Payment Status
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPaid(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  !isPaid
                    ? 'bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs'
                    : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                }`}
              >
                UNPAID
              </button>
              <button
                type="button"
                onClick={() => setIsPaid(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isPaid
                    ? 'bg-emerald-600 text-white border border-emerald-700 shadow-xs'
                    : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                }`}
              >
                PAID
              </button>
            </div>
          </div>

          {/* If Paid, show payment proof fields */}
          {isPaid && (
            <div className="flex flex-col gap-3.5 pt-1">
              {/* Payment Receipt Image Upload & Canvas Compression */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Tenant Payment Receipt / QR Screenshot
                </label>

                {receiptImage ? (
                  <div className="relative rounded-xl border-2 border-dashed border-stone-300 p-2 bg-stone-50 flex items-center gap-3">
                    <img
                      src={receiptImage}
                      alt="Payment proof preview"
                      onClick={() => onViewReceiptFull?.(receiptImage, `${bill.unit} Payment Receipt`)}
                      className="w-16 h-16 object-cover rounded-lg border border-stone-200 shadow-2xs cursor-pointer hover:opacity-90"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-stone-800">Receipt Attached</p>
                      <p className="text-[11px] text-stone-500">Auto-compressed HTML5 canvas image</p>
                      <button
                        type="button"
                        onClick={() => onViewReceiptFull?.(receiptImage, `${bill.unit} Payment Receipt`)}
                        className="text-[11px] text-stone-700 underline font-medium hover:text-black cursor-pointer mr-3"
                      >
                        View Full Size
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="p-2 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Remove image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-stone-300 hover:border-stone-400 rounded-xl p-4 text-center bg-stone-50 hover:bg-stone-100 transition-colors cursor-pointer flex flex-col items-center justify-center gap-1.5"
                  >
                    <Upload className="w-6 h-6 text-stone-400" />
                    <span className="text-xs font-semibold text-stone-700">
                      {isCompressing ? 'Compressing image...' : 'Tap to upload or take photo of receipt'}
                    </span>
                    <span className="text-[10px] text-stone-500">
                      Supports GCash, Maya, Bank QR, or Cash voucher (Auto-compressed to 900px JPEG)
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

              {/* Date Paid & Payment Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Date Paid</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={datePaid}
                      onChange={(e) => setDatePaid(e.target.value)}
                      required={isPaid}
                      className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-[#2C332B] bg-stone-50"
                    />
                  </div>
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
              </div>

              {/* Reference # & Amount Paid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Reference / Ref #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 102938475"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-[#2C332B] bg-stone-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Amount Received (₱)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-[#2C332B] bg-stone-50"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Notes / Remarks</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Paid in full via GCash Express Send"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-[#2C332B] bg-stone-50"
                />
              </div>
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isCompressing}
              className="px-5 py-2 rounded-lg text-xs font-bold bg-[#2C332B] text-white hover:bg-[#1E231D] transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving & Syncing...' : 'Save Payment Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
