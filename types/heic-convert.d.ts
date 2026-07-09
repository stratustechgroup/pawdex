// Minimal ambient declaration for heic-convert. The package ships without
// types in 2026; this covers the single call shape we use in
// lib/ingest/preprocess.ts.

declare module "heic-convert" {
  interface HeicConvertOptions {
    buffer: ArrayBuffer | Uint8Array;
    format: "JPEG" | "PNG";
    quality?: number;
  }

  /**
   * Convert HEIC/HEIF buffer to JPEG/PNG. Returns an ArrayBuffer of the
   * converted image bytes.
   */
  function heicConvert(opts: HeicConvertOptions): Promise<ArrayBuffer>;
  export default heicConvert;
}
