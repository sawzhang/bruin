import {
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  isYesterday,
  isToday,
  format,
  parseISO,
} from "date-fns";

/**
 * Format a date string into a human-friendly relative time.
 * Returns "Just now", "5m ago", "2h ago", "Yesterday", "Feb 21", "Dec 3, 2025", etc.
 */
export function formatRelativeDate(dateStr: string): string {
  const date = parseISO(dateStr);
  const now = new Date();

  const minutesAgo = differenceInMinutes(now, date);
  if (minutesAgo < 1) {
    return "Just now";
  }

  if (minutesAgo < 60) {
    return `${minutesAgo}m ago`;
  }

  const hoursAgo = differenceInHours(now, date);
  if (hoursAgo < 24 && isToday(date)) {
    return `${hoursAgo}h ago`;
  }

  if (isYesterday(date)) {
    return "Yesterday";
  }

  const daysAgo = differenceInDays(now, date);
  if (daysAgo < 365) {
    return format(date, "MMM d");
  }

  return format(date, "MMM d, yyyy");
}

/**
 * Truncate text to maxLen characters, safe for multi-byte characters (emoji, CJK).
 * Finds the last space before the limit to avoid cutting words when possible.
 */
export function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) {
    return text;
  }

  // Use Array.from to properly handle multi-byte characters
  const chars = Array.from(text);
  if (chars.length <= maxLen) {
    return text;
  }

  // Find a good break point (last space within limit)
  const truncated = chars.slice(0, maxLen).join("");
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLen * 0.5) {
    return truncated.slice(0, lastSpace) + "...";
  }

  return truncated + "...";
}
