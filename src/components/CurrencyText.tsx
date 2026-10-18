import React from 'react';

interface CurrencyTextProps {
  amount: number;
  className?: string;
  symbolClassName?: string;
  noDecimals?: boolean;
  roundUp?: boolean;
}

export const PesoSymbol: React.FC<{ className?: string }> = ({
  className = 'mr-0.5 text-inherit',
}) => {
  return (
    <span
      className={`font-sans font-bold inline-block select-none ${className}`}
      style={{
        fontFamily:
          '"Noto Sans", "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
      aria-label="Philippine Peso"
    >
      ₱
    </span>
  );
};

export const CurrencyText: React.FC<CurrencyTextProps> = ({
  amount,
  className = '',
  symbolClassName = '',
  noDecimals = false,
  roundUp = false,
}) => {
  const rawSafe = isNaN(amount) ? 0 : amount;
  const safe = roundUp ? Math.ceil(Number(rawSafe.toFixed(4))) : rawSafe;
  const formattedNumber = safe.toLocaleString('en-US', {
    minimumFractionDigits: noDecimals ? 0 : 2,
    maximumFractionDigits: noDecimals ? 0 : 2,
  });

  return (
    <span className={`inline-flex items-baseline ${className}`}>
      <PesoSymbol className={`font-bold mr-0.5 shrink-0 ${symbolClassName}`} />
      <span>{formattedNumber}</span>
    </span>
  );
};

