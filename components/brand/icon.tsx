import type { CSSProperties } from "react";

// Lucide-style icons (single weight, 1.7 stroke). Inline SVG paths so they're
// free to size/color via CSS. Ported from the Claude Design source.

const PATHS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z",
  paw: "M9 18a3 3 0 0 1-3-3 4 4 0 0 1 6-3.5 4 4 0 0 1 6 3.5 3 3 0 0 1-3 3M5.5 11a1.8 2.2 0 1 1 0-4.4 1.8 2.2 0 1 1 0 4.4M18.5 11a1.8 2.2 0 1 1 0-4.4 1.8 2.2 0 1 1 0 4.4M9 7.5A2 2.5 0 1 1 9 2.5 2 2.5 0 1 1 9 7.5M15 7.5A2 2.5 0 1 1 15 2.5 2 2.5 0 1 1 15 7.5",
  bell: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  plus: "M12 5v14M5 12h14",
  arrowRight: "M5 12h14M13 5l7 7-7 7",
  arrowLeft: "M19 12H5M12 19l-7-7 7-7",
  chevronRight: "M9 6l6 6-6 6",
  chevronDown: "M6 9l6 6 6-6",
  chevronUp: "M18 15l-6-6-6 6",
  check: "M5 12l5 5L20 7",
  checkCircle: "M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  x: "M18 6 6 18M6 6l12 12",
  search: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  calendar:
    "M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
  fileText:
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  fileCheck:
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 15l2 2 4-4",
  paperclip:
    "M21.4 11.05 12.25 20.2a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.38a2 2 0 1 1-2.83-2.83l8.49-8.49",
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
  trendUp: "M22 7l-9.5 9.5L8 12l-6 6M16 7h6v6",
  trendDown: "M22 17l-9.5-9.5L8 12l-6-6M16 17h6v-6",
  minus: "M5 12h14",
  syringe: "M18 2l4 4M19 5l-7 7M16 8 8 16l-2 6 6-2 8-8M9 13l3 3",
  pill: "M10.5 21A9 9 0 1 1 21 10.5L10.5 21zM8.5 8.5l7 7",
  scale:
    "M3 5h18M6 5l1.6 13.4a2 2 0 0 0 2 1.6h4.8a2 2 0 0 0 2-1.6L18 5M8 5V3a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  heart:
    "M20.84 4.6a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  shieldCheck:
    "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6 12 13 2 6",
  camera:
    "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  edit: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z",
  copy: "M16 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2M16 4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2",
  link: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  externalLink:
    "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01",
  alert:
    "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  sparkles:
    "M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5zM19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7zM5 14l.7 2.3L8 17l-2.3.7L5 20l-.7-2.3L2 17l2.3-.7z",
  menu: "M3 6h18M3 12h18M3 18h18",
  moreH: "M5 12h.01M12 12h.01M19 12h.01",
  moreV: "M12 5h.01M12 12h.01M12 19h.01",
  refresh: "M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
  eye: "M2 12s3.5-8 10-8 10 8 10 8-3.5 8-10 8S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  receipt:
    "M20 22V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v17l3-2 3 2 3-2 3 2zM8 7h8M8 11h8M8 15h5",
  inbox:
    "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42",
  moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  stethoscope:
    "M11 2v2M5 2v2M5 3h6v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3zM8 12v6a4 4 0 0 0 8 0v-1a4 4 0 0 1 4-4M20 13a2 2 0 1 1 0 4 2 2 0 0 1 0-4z",
  helpCircle:
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01",
  logOut:
    "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.7,
  className,
  style,
}: {
  name: IconName | string;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}
