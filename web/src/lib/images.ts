/**
 * Image URL helpers.
 *
 * With PUBLIC_IMAGE_BASE set (e.g. https://img.yoursite.com — your R2 public bucket / custom domain),
 * photos resolve to  {BASE}/{project}/{file}-{width}.webp  which is what the build script will upload.
 * Without it, we generate offline placeholder art so the site runs with zero assets.
 */
export const WIDTHS = [600, 1200, 2400] as const;
const BASE = (import.meta.env.PUBLIC_IMAGE_BASE as string | undefined)?.replace(/\/$/, "");

import type { ExifInfo } from "./exif";

export type Photo = {
  file: string;
  title: string;
  w: number;
  h: number;
  /** up to 3 dominant colours as hex, precomputed at build time (optional) */
  colors?: string[];
  /** tiny blurred preview, data URI (optional, produced by build script) */
  blur?: string;
  /** widths actually generated for this photo (smaller originals have fewer) */
  widths?: number[];
  /** camera settings read from the original (see scripts/photos.mjs); optional */
  exif?: ExifInfo;
  /** content hash prefix, appended as ?v= so a replaced photo busts the CDN cache */
  v?: string;
};

export type GalleryPhoto = Photo & { project: string; projectTitle: string };

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

function placeholder(p: Photo): string {
  const W = 800, H = Math.round((800 * p.h) / p.w), s = hash(p.file) % 1000;
  const hue = (s * 47) % 360, h2 = (hue + 35) % 360;
  const rnd = (n: number) => { const x = Math.sin(s * 99.7 + n * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const ridge = (n: number, y0: number, col: string) => {
    let d = `M0 ${H}`;
    for (let i = 0; i <= 8; i++) d += ` L${Math.round((W * i) / 8)} ${Math.round(H * (y0 + (rnd(n + i) - 0.5) * 0.16))}`;
    return `<path d="${d} L${W} ${H}Z" fill="${col}"/>`;
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue},45%,22%)"/><stop offset=".6" stop-color="hsl(${h2},55%,55%)"/><stop offset="1" stop-color="hsl(${h2},60%,72%)"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/><circle cx="${W * (0.25 + rnd(1) * 0.5)}" cy="${H * 0.5}" r="${W * 0.06}" fill="hsla(${h2},80%,90%,.55)"/>${ridge(10, 0.62, `hsl(${hue},30%,28%)`)}${ridge(30, 0.74, `hsl(${hue},28%,18%)`)}${ridge(50, 0.88, `hsl(${hue},25%,10%)`)}</svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

const widthsOf = (p: Photo): readonly number[] => p.widths?.length ? p.widths : WIDTHS;

/** Smallest generated width >= requested (or the largest available) */
const pick = (p: Photo, width: number) => {
  const ws = widthsOf(p);
  return ws.find((w) => w >= width) ?? ws[ws.length - 1];
};

export const imageUrl = (project: string, p: Photo, width: number) =>
  BASE ? `${BASE}/${project}/${p.file}-${pick(p, width)}.webp${p.v ? `?v=${p.v}` : ""}` : placeholder(p);

/** srcset for grid images; undefined in placeholder mode */
export const srcSet = (project: string, p: Photo) =>
  BASE ? widthsOf(p).map((w) => `${imageUrl(project, p, w)} ${w}w`).join(", ") : undefined;

/** Largest generated width, for the full-screen view */
export const maxWidth = (p: Photo) => widthsOf(p)[widthsOf(p).length - 1];
