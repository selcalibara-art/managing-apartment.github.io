import React from 'react';

interface CurrencyTextProps {
  amount: number;
  className?: string;
  symbolClassName?: string;
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
}) => {
  const safe = isNaN(amount) ? 0 : amount;
  const formattedNumber = safe.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <span className={`inline-flex items-baseline ${className}`}>
      <PesoSymbol className={`font-bold mr-0.5 shrink-0 ${symbolClassName}`} />
      <span>{formattedNumber}</span>
    </span>
  );
};
