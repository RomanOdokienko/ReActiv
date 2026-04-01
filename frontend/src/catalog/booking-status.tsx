import type { ReactNode } from "react";

export type BookingStatusTone = "reserved" | "free" | "default";

function normalizeBookingStatus(status: string | null | undefined): string {
  return (status ?? "").trim().toLowerCase();
}

export function getBookingStatusTone(status: string | null | undefined): BookingStatusTone {
  const normalized = normalizeBookingStatus(status);
  if (!normalized) {
    return "default";
  }

  if (normalized.includes("резерв")) {
    return "reserved";
  }

  if (normalized.includes("свобод") || normalized.includes("свободн") || normalized.includes("в свободной продаже")) {
    return "free";
  }

  return "default";
}

export function renderBookingStatusBadge(
  status: string | null | undefined,
  fallback = "-",
): ReactNode {
  const value = (status ?? "").trim();
  const text = value || fallback;
  const tone = getBookingStatusTone(status);

  return (
    <span className={`booking-status-badge booking-status-badge--${tone}`}>{text}</span>
  );
}
