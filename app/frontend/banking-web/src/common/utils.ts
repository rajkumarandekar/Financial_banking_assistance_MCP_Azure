import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parses a server-provided timestamp as UTC even when it has no timezone
 * designator (older records were written by a backend bug that stamped
 * naive local-time datetimes - see _chatkit_events_handler.py). Without
 * this, `new Date(...)` on a bare "2026-08-20T10:10:40" string is parsed
 * as browser-local time, throwing every "time ago" off by the viewer's
 * UTC offset (5.5h for IST).
 */
export function parseServerDate(iso: string): Date {
  const hasTimezone = /[zZ]|[+-]\d{2}:\d{2}$/.test(iso);
  return new Date(hasTimezone ? iso : `${iso}Z`);
}
