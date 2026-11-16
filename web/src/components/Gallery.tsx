import { useState } from "react";
import Lightbox from "./Lightbox";
import { imageUrl, srcSet, type GalleryPhoto } from "../lib/images";

type Props = {
  photos: GalleryPhoto[];
  /**
   * "masonry": optional full-width first photo, then 3 columns (collection pages).
   * "stack":   two photos per row, same-orientation neighbours paired at equal height; a lone photo is centred.
   * "columns": the first photo full-width (if it is a landscape), then masonry with `columns` columns where each
   *            photo goes into the currently shortest column, so the list order reads left-to-right across the page
   *            (good for curated lists like highlights).
   */
  layout?: "masonry" | "stack" | "columns";
  /** "columns" only: number of columns (default 2) */
  columns?: number;
  /** masonry only: first landscape photo shown full-width above the grid (like davidimel.com) */
  hero?: boolean;
  /** Add the collection name to hover captions (for the cross-collection highlights page) */
  showProject?: boolean;
};

const isLandscape = (p: GalleryPhoto) => p.w > p.h;

/**
 * Group photo indexes into rows of two consecutive photos with the same orientation
 * (landscape+landscape or portrait+portrait). A photo with no same-shaped neighbour sits alone.
 * The list order is never changed.
 */
function stackRows(photos: GalleryPhoto[]): number[][] {
  const rows: number[][] = [];
  for (let i = 0; i < photos.length; ) {
    if (i + 1 < photos.length && isLandscape(photos[i]) === isLandscape(photos[i + 1])) {
      rows.push([i, i + 1]);
      i += 2;
    } else {
      rows.push([i]);
      i += 1;
    }
  }
  return rows;
}

/** Spread photo indexes over n columns, always adding to the shortest one (ties go left). Order of `photos` is preserved. */
function shortestColumns(photos: GalleryPhoto[], n: number, skip = -1): number[][] {
  const cols = Array.from({ length: n }, () => ({ idx: [] as number[], h: 0 }));
  photos.forEach((p, i) => {
    if (i === skip) return;
    let target = cols[0];
    for (const c of cols) if (c.h < target.h - 1e-9) target = c;
    target.idx.push(i);
    target.h += p.h / p.w; // column width is equal for all columns, so relative height = h / w
  });
  return cols.map((c) => c.idx);
}

export default function Gallery({ photos, layout = "masonry", columns = 2, hero = true, showProject = false }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  // "masonry": featured photo = first landscape one (a full-width portrait would be enormous).
  // "columns": the first photo in the list, if it is a landscape (the list order is the curated order).
  const heroIndex = !hero
    ? -1
    : layout === "masonry"
      ? photos.findIndex(isLandscape)
      : layout === "columns" && photos.length && isLandscape(photos[0])
        ? 0
        : -1;

  const fig = (p: GalleryPhoto, i: number, sizes: string, isHero = false) => (
    <figure
      key={p.project + p.file}
      className={"ph" + (isHero ? " hero" : "")}
      style={{ ["--ar" as string]: (p.w / p.h).toFixed(3) }}
      onClick={() => setOpen(i)}
    >
      <img
        src={imageUrl(p.project, p, 1200)}
        srcSet={srcSet(p.project, p)}
        sizes={sizes}
        width={p.w}
        height={p.h}
        alt={p.title}
        loading={isHero || i < 4 ? "eager" : "lazy"}
        decoding="async"
        className="loaded"
        style={p.blur ? { background: `center/cover url(${p.blur})` } : undefined}
      />
      <figcaption className="cap">
        {p.title}
        {showProject ? ` — ${p.projectTitle}` : ""}
      </figcaption>
    </figure>
  );

  const HERO_SIZES = "(min-width:1500px) 1436px, 100vw";
  const GRID_SIZES = "(min-width:720px) 33vw, 50vw";

  return (
    <div className="rows">
      {layout === "columns" ? (
        <>
          {heroIndex >= 0 && fig(photos[heroIndex], heroIndex, HERO_SIZES, true)}
          <div className="mcols">
            {shortestColumns(photos, columns, heroIndex).map((col, ci) => (
              <div className="mcol" key={ci}>
                {col.map((i) => fig(photos[i], i, `(min-width:1500px) ${Math.round(1436 / columns)}px, ${Math.round(100 / columns)}vw`))}
              </div>
            ))}
          </div>
        </>
      ) : layout === "stack" ? (
        stackRows(photos).map((row) => {
          const kind = row.length === 2 ? "pair" : "single";
          return (
            <div key={row.join("-")} className={`stack-row ${kind}`}>
              {row.map((i) => fig(photos[i], i, kind === "pair" ? "(min-width:1500px) 920px, 64vw" : "(min-width:1500px) 718px, 50vw"))}
            </div>
          );
        })
      ) : (
        <>
          {heroIndex >= 0 && fig(photos[heroIndex], heroIndex, HERO_SIZES, true)}
          <div className="masonry">{photos.map((p, i) => (i === heroIndex ? null : fig(p, i, GRID_SIZES)))}</div>
        </>
      )}
      {open !== null && <Lightbox photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}
