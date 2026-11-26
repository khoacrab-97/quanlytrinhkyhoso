// Tiện ích ngày giờ dùng chung (hiển thị theo định dạng Việt Nam).
const DAY = 86_400_000;

export function daysBetween(a: Date | string, b: Date | string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / DAY;
}

export function addDays(d: Date | string, n: number) {
  return new Date(new Date(d).getTime() + n * DAY);
}

export function fmtDate(d?: Date | string | null) {
  if (!d) return "";
  const x = new Date(d);
  if (isNaN(x.getTime())) return "";
  return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`;
}

export function fmtDateTime(d?: Date | string | null) {
  if (!d) return "";
  const x = new Date(d);
  return `${fmtDate(x)} ${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
}

/** yyyy-mm-dd cho input[type=date] (theo giờ địa phương) */
export function toInputDate(d?: Date | string | null) {
  if (!d) return "";
  const x = new Date(d);
  if (isNaN(x.getTime())) return "";
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export function monthKey(d: Date | string) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `T${Number(m)}/${y}`;
}

export function periodKey(d: Date | string, period: "day" | "month" | "quarter" | "year") {
  const x = new Date(d);
  const y = x.getFullYear();
  if (period === "year") return `${y}`;
  if (period === "quarter") return `${y}-Q${Math.floor(x.getMonth() / 3) + 1}`;
  if (period === "month") return monthKey(x);
  return toInputDate(x);
}

export function periodLabel(key: string, period: "day" | "month" | "quarter" | "year") {
  if (period === "year") return `Năm ${key}`;
  if (period === "quarter") {
    const [y, q] = key.split("-Q");
    return `Q${q}/${y}`;
  }
  if (period === "month") return monthLabel(key);
  return fmtDate(key);
}

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function pct(part: number, total: number) {
  return total ? round1((part / total) * 100) : 0;
}
