// lib/analysisDateLogic.js — perbandingan hari yang sama untuk analisis F&B

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** @returns {"weekday"|"weekend"|"holiday"} */
export function getDayType(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return "weekend";
  return "weekday";
}

export function getSameWeekdayLastWeek(date) {
  const lastWeek = new Date(date);
  lastWeek.setDate(date.getDate() - 7);
  return lastWeek;
}

export function getComparisonDate(targetDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const dayName = dayNames[target.getDay()];
  const compareDate = getSameWeekdayLastWeek(target);
  const compareDayName = dayNames[compareDate.getDay()];

  const isToday = target.toDateString() === today.toDateString();
  const isYesterday = target.toDateString() === yesterday.toDateString();

  if (isToday) {
    return {
      compareDate,
      compareLabel: `${dayName} lalu`,
      reason: `Dibandingkan ${compareDayName} minggu lalu — hari yang sama lebih akurat untuk F&B`,
    };
  }

  if (isYesterday) {
    return {
      compareDate,
      compareLabel: `${dayName} lalu`,
      reason: `Dibandingkan ${compareDayName} minggu lalu — bukan kemarin lusa`,
    };
  }

  return {
    compareDate,
    compareLabel: `${dayName} minggu lalu`,
    reason: "Setiap hari dibandingkan dengan hari yang sama minggu sebelumnya",
  };
}

export function getPeriodComparison(periodeHari) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentFrom = new Date(today);
  currentFrom.setDate(today.getDate() - (periodeHari - 1));
  const currentTo = new Date(today);

  const compareFrom = new Date(currentFrom);
  compareFrom.setDate(currentFrom.getDate() - 7);
  const compareTo = new Date(currentTo);
  compareTo.setDate(currentTo.getDate() - 7);

  const fmt = (d) =>
    d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });

  return {
    current: {
      from: currentFrom,
      to: currentTo,
      label: `${fmt(currentFrom)} – ${fmt(currentTo)}`,
    },
    compare: {
      from: compareFrom,
      to: compareTo,
      label: `${fmt(compareFrom)} – ${fmt(compareTo)}`,
    },
    note: "Dibandingkan minggu yang sama sebelumnya — bukan tanggal biasa",
  };
}

export function groupTransactionsByDayOfWeek(transactions, current, compare) {
  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  const filterByRange = (txs, from, to) => {
    const fromStr = toDateStr(from);
    const toStr = toDateStr(to);
    return txs.filter((t) => t.type === "in" && t.date >= fromStr && t.date <= toStr);
  };

  const sumByDay = (txs) => {
    const map = {};
    for (const t of txs) {
      map[t.date] = (map[t.date] ?? 0) + (t.amount || 0);
    }
    return map;
  };

  const currentTxs = filterByRange(transactions || [], current.from, current.to);
  const compareTxs = filterByRange(transactions || [], compare.from, compare.to);

  const currentByDate = sumByDay(currentTxs);
  const compareByDate = sumByDay(compareTxs);

  const lines = [];
  const cursor = new Date(current.from);
  const compareCursor = new Date(compare.from);

  while (cursor <= current.to) {
    const dayName = dayNames[cursor.getDay()];
    const dateStr = toDateStr(cursor);
    const compareDateStr = toDateStr(compareCursor);

    const omsetIni = currentByDate[dateStr] ?? 0;
    const omsetLalu = compareByDate[compareDateStr] ?? 0;
    const diff = omsetIni - omsetLalu;
    const pct = omsetLalu > 0 ? Math.round((diff / omsetLalu) * 100) : 0;
    const arrow = diff >= 0 ? "▲" : "▼";

    lines.push(
      `${dayName} (${dateStr}): Rp${omsetIni.toLocaleString("id-ID")} vs ${compareDateStr}: Rp${omsetLalu.toLocaleString("id-ID")} ${arrow}${Math.abs(pct)}%`
    );

    cursor.setDate(cursor.getDate() + 1);
    compareCursor.setDate(compareCursor.getDate() + 1);
  }

  return lines.length ? lines.join("\n") : "Belum ada data omset (type=in) di periode ini.";
}
