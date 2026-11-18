import { useCallback, useEffect, useRef, useState } from "react";
import { imageUrl, maxWidth, type GalleryPhoto } from "../lib/images";
import { topColors } from "../lib/colors";
import { exifParts } from "../lib/exif";

type Props = { photos: GalleryPhoto[]; index: number; onIndex: (i: number) => void; onClose: () => void };

export default function Lightbox({ photos, index, onIndex, onClose }: Props) {
  const p = photos[index];
  const imgRef = useRef<HTMLImageElement>(null);
  const [colors, setColors] = useState<string[]>(p.colors ?? []);
  const [copied, setCopied] = useState<string | null>(null);
  const exif = exifParts(p.exif);

  const step = useCallback((d: number) => onIndex((index + d + photos.length) % photos.length), [index, photos.length, onIndex]);

  // Keyboard + scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose, step]);

  // Colours: precomputed in the manifest if present, otherwise sampled from the loaded image
  useEffect(() => setColors(p.colors ?? []), [p]);
  const onLoad = () => {
    if (p.colors?.length || !imgRef.current) return;
    try { setColors(topColors(imgRef.current)); } catch { setColors([]); }
  };

  // Preload neighbours
  useEffect(() => {
    [1, -1].forEach((d) => {
      const q = photos[(index + d + photos.length) % photos.length];
      new Image().src = imageUrl(q.project, q, maxWidth(q));
    });
  }, [index, photos]);

  // Touch gestures: swipe left/right = previous/next, swipe down = close. Two-finger pinches and
  // swipes while the page is pinch-zoomed are left to the browser (zooming into a photo's detail).
  const touch0 = useRef<{ x: number; y: number } | null>(null);

  const copy = (hex: string) => {
    navigator.clipboard?.writeText(hex);
    setCopied(hex);
    setTimeout(() => setCopied(null), 700);
  };

  return (
    <div
      className="lb open"
      role="dialog"
      aria-modal="true"
      aria-label={p.title}
      onTouchStart={(e) => {
        touch0.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
      }}
      onTouchCancel={() => (touch0.current = null)}
      onTouchEnd={(e) => {
        const s = touch0.current;
        touch0.current = null;
        if (!s || e.changedTouches.length !== 1) return;
        if ((window.visualViewport?.scale ?? 1) > 1.05) return;
        const dx = e.changedTouches[0].clientX - s.x;
        const dy = e.changedTouches[0].clientY - s.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
        else if (dy > 90 && dy > Math.abs(dx) * 1.5) onClose();
      }}
    >
      <button className="lb-btn lb-close" aria-label="Close" onClick={onClose}>✕</button>
      <button className="lb-btn lb-prev" aria-label="Previous" onClick={() => step(-1)}>‹</button>
      <button className="lb-btn lb-next" aria-label="Next" onClick={() => step(1)}>›</button>
      <div className="lb-stage" onClick={onClose}>
        <img ref={imgRef} key={p.file} src={imageUrl(p.project, p, maxWidth(p))} alt={p.title} onLoad={onLoad} />
      </div>
      <div className="lb-bar">
        <div className="lb-info">
          <span className="t">{p.title} · {p.projectTitle}</span>
          {exif.length > 0 && <span className="meta">{exif.join(" · ")}</span>}
        </div>
        <div className="lb-side">
          <span className="sw">
            {colors.map((hex) => (
              <button
                key={hex}
                className={"sq" + (copied === hex ? " copied" : "")}
                style={{ background: hex }}
                title={`${hex} — click to copy`}
                onClick={() => copy(hex)}
              />
            ))}
          </span>
          <span className="n">{index + 1} / {photos.length}</span>
        </div>
      </div>
    </div>
  );
}
