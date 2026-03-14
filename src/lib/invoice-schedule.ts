function parseIsoDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function addMonthsPreservingDay(baseDate: Date, targetDay: number) {
  const nextMonthIndex = baseDate.getMonth() + 1;
  const year = baseDate.getFullYear() + Math.floor(nextMonthIndex / 12);
  const monthIndex = nextMonthIndex % 12;
  const day = Math.min(targetDay, getDaysInMonth(year, monthIndex));
  return new Date(year, monthIndex, day);
}

export function calculateNextInvoicePaymentDate({
  installmentType,
  dueDate,
  referenceDate,
}: {
  installmentType?: string | null;
  dueDate?: string | null;
  referenceDate?: string | null;
}) {
  const baseDate = parseIsoDate(referenceDate) ?? parseIsoDate(dueDate);
  if (!baseDate) {
    return null;
  }

  if (installmentType === "twice_a_month") {
    const nextDate = new Date(baseDate);
    nextDate.setDate(nextDate.getDate() + 15);
    return formatIsoDate(nextDate);
  }

  const anchorDay = parseIsoDate(dueDate)?.getDate() ?? baseDate.getDate();
  return formatIsoDate(addMonthsPreservingDay(baseDate, anchorDay));
}
