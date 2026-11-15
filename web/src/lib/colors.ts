/** Fallback when a photo has no precomputed colours: sample the loaded <img> on a canvas.
 *  Buckets pixels to 4 bits/channel, ranks by count, keeps colours visibly different from each other. */
export function topColors(img: HTMLImageElement, n = 3): string[] {
  const S = 48, c = document.createElement("canvas");
  c.width = c.height = S;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  const r = Math.min(S / img.naturalWidth, S / img.naturalHeight);
  const w = Math.max(1, Math.round(img.naturalWidth * r)), h = Math.max(1, Math.round(img.naturalHeight * r));
  x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, bins = new Map<number, number[]>();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    const b = bins.get(k) ?? [0, 0, 0, 0];
    b[0]++; b[1] += d[i]; b[2] += d[i + 1]; b[3] += d[i + 2];
    bins.set(k, b);
  }
  const ranked = [...bins.values()].sort((a, b) => b[0] - a[0]).map((b) => [b[1] / b[0], b[2] / b[0], b[3] / b[0]].map(Math.round));
  const out: number[][] = [];
  for (const t of [60, 36, 18, 0]) {
    for (const c of ranked) {
      if (out.length >= n) break;
      if (!out.includes(c) && out.every((o) => Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2]) > t)) out.push(c);
    }
  }
  return out.map(([r, g, b]) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join(""));
}
