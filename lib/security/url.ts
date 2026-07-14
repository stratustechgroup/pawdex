// User-supplied URLs that render as clickable hrefs must be plain web URLs.
// Anything else (javascript:, data:, vbscript:, protocol-relative tricks that
// fail URL parsing) is dropped rather than rendered.
export function sanitizeHttpUrl(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
