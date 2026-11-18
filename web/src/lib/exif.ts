/** Camera settings for one photo, written by scripts/photos.mjs (never includes location). */
export type ExifInfo = {
  camera?: string;
  lens?: string;
  /** focal length in mm, and its 35mm-equivalent */
  focal?: number;
  focal35?: number;
  /** aperture, e.g. 6.4 for f/6.4 */
  f?: number;
  /** already formatted, e.g. "1/850s" */
  shutter?: string;
  iso?: number;
  /** exposure compensation in EV; omitted when 0 */
  ev?: number;
  /** date taken, YYYY-MM-DD */
  date?: string;
  /** true for scanned film: the camera is set by hand, there are no exposure details */
  film?: boolean;
};

/** The pieces of the line shown under a photo, in reading order. Empty when there is no EXIF. */
export function exifParts(e?: ExifInfo): string[] {
  if (!e) return [];
  const parts: string[] = [];
  if (e.camera) parts.push(e.camera);
  if (e.film) parts.push("Scanned film");
  if (e.lens) parts.push(e.lens);
  if (e.focal) parts.push(`${e.focal}mm`);
  if (e.f) parts.push(`f/${e.f}`);
  if (e.shutter) parts.push(e.shutter);
  if (e.iso) parts.push(`ISO ${e.iso}`);
  if (typeof e.ev === "number" && e.ev !== 0) parts.push(`${e.ev > 0 ? "+" : "−"}${Math.abs(e.ev)} EV`);
  return parts;
}
