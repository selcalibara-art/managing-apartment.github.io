import React from 'react';
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react';

interface ReceiptLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  title?: string;
}

export const ReceiptLightbox: React.FC<ReceiptLightboxProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title = 'Payment Receipt Proof',
}) => {
  const [zoom, setZoom] = React.useState(1);

  if (!isOpen || !imageUrl) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `Calibara_Payment_Proof_${Date.now()}.jpg`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 select-none">
      {/* Top Bar */}
      <div className="w-full max-w-4xl flex items-center justify-between text-white py-2 px-3">
        <h4 className="text-sm font-semibold truncate text-stone-200">{title}</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
            className="p-2 rounded-lg bg-stone-800 text-stone-200 hover:bg-stone-700 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
            className="p-2 rounded-lg bg-stone-800 text-stone-200 hover:bg-stone-700 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleDownload}
            className="p-2 rounded-lg bg-stone-800 text-stone-200 hover:bg-stone-700 transition-colors"
            title="Download Image"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setZoom(1);
              onClose();
            }}
            className="p-2 rounded-lg bg-rose-900/80 text-white hover:bg-rose-800 transition-colors ml-2 cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Image Center View */}
      <div
        className="flex-1 flex items-center justify-center w-full overflow-auto p-2"
        onClick={() => setZoom((z) => (z > 1 ? 1 : 1.5))}
      >
        <img
          src={imageUrl}
          alt={title}
          style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s ease-out' }}
          className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl cursor-zoom-in"
        />
      </div>

      {/* Bottom Hint */}
      <p className="text-[11px] text-stone-400 py-1">
        Tap image to toggle zoom • Max 900px compressed JPEG proof
      </p>
    </div>
  );
};
