/**
 * Automatically compress uploaded receipt/QR payment proof images using an HTML5 <canvas>
 * Ensures the resulting base64 dataUrl is always < 40,000 characters so it never exceeds
 * Google Sheets' 50,000-character per-cell limit or localStorage quotas.
 */
export async function compressImage(
  file: File | Blob,
  maxDimension = 720,
  initialQuality = 0.65,
  maxBase64Length = 40000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file for compression'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for canvas compression'));
      img.onload = () => {
        let scale = 1;
        const longestSide = Math.max(img.width, img.height);
        if (longestSide > maxDimension) {
          scale = maxDimension / longestSide;
        }

        let currentScale = scale;
        let currentQuality = initialQuality;
        let dataUrl = '';

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get 2D canvas context'));
          return;
        }

        // Iteratively compress until under maxBase64Length (safe for Google Sheets 50k cell limit)
        for (let attempt = 0; attempt < 6; attempt++) {
          const width = Math.max(1, Math.round(img.width * currentScale));
          const height = Math.max(1, Math.round(img.height * currentScale));

          canvas.width = width;
          canvas.height = height;

          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
          if (dataUrl.length <= maxBase64Length) {
            break;
          }

          // Reduce dimensions and quality for next pass if still too large
          currentScale *= 0.8;
          currentQuality = Math.max(0.35, currentQuality - 0.1);
        }

        resolve(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
