export function formatLakhAsCrore(amountLakh: number): string {
  return `₹${(amountLakh / 100).toFixed(2)} Cr`;
}
