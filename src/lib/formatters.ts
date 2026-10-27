export function formatNumber(value: number | null | undefined, maximumFractionDigits = 0): string {
  const number = Number(value ?? 0);
  return (Number.isFinite(number) ? number : 0).toLocaleString("en-US", { maximumFractionDigits });
}

export function formatAmount(value: number | null | undefined): string {
  const number = Number(value ?? 0);
  return (Number.isFinite(number) ? number : 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
