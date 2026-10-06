const takaFormatter = new Intl.NumberFormat('en-BD', {
  maximumFractionDigits: 0,
});

export function formatTaka(amount: number): string {
  return `৳${takaFormatter.format(amount)}`;
}

