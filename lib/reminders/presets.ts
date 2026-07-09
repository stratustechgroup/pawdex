// Pure constants + helpers — safe to import from client OR server. Server-only
// data access lives in lib/db/reminder-preferences.ts.

export const TIMEZONE_OPTIONS = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

export const LEAD_DAY_PRESETS = {
  standard: { label: "Standard", days: [30, 14, 7, 1] },
  aggressive: { label: "Aggressive", days: [60, 30, 14, 7, 3, 1] },
  minimal: { label: "Minimal", days: [7, 1] },
} as const;

export type LeadDayPreset = keyof typeof LEAD_DAY_PRESETS;

export function presetFromDays(days: number[]): LeadDayPreset | "custom" {
  for (const [key, preset] of Object.entries(LEAD_DAY_PRESETS)) {
    if (
      preset.days.length === days.length &&
      preset.days.every((d, i) => d === days[i])
    ) {
      return key as LeadDayPreset;
    }
  }
  return "custom";
}
