function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function formatRelativeRegionTime(value: string, city = "广东", prefix = "") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return city;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.floor((todayStart - targetStart) / 86400000);
  const timePart = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  const monthDayPart = `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

  if (diffDays <= 0) return `${prefix}${timePart} ${city}`;
  if (diffDays === 1) return `${prefix}昨天${timePart} ${city}`;
  return `${prefix}${monthDayPart} ${city}`;
}

export function hasEditedTimestamp(createdAt: string, updatedAt: string) {
  const created = new Date(createdAt);
  const updated = new Date(updatedAt);
  if (Number.isNaN(created.getTime()) || Number.isNaN(updated.getTime())) return false;
  return Math.abs(updated.getTime() - created.getTime()) > 1000;
}
