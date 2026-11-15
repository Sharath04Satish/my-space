import { useState } from "react";
import Lightbox from "./Lightbox";
import { imageUrl, srcSet, type GalleryPhoto } from "../lib/images";

type Props = {
  photos: GalleryPhoto[];
  /**
   * "masonry": optional full-width first photo, then 3 columns (collection pages).
   * "stack":   every landscape photo full-width; portraits two per row (highlights page).
   */
  layout?: "masonry" | "stack";
  /** masonry only: first landscape photo shown full-width above the grid (like davidimel.com) */
  hero?: boolean;
  /** Add the collection name to hover captions (for the cross-collection highlights page) */
  showProject?: boolean;
};

const isLandscape = (p: GalleryPhoto) => p.w > p.h;

/** Group photo indexes into rows: a landscape alone, or two consecutive portraits (order is never changed). */
function stackRows(photos: GalleryPhoto[]): number[][] {
  const rows: number[][] = [];
  for (let i = 0; i < photos.length; ) {
    if (!isLandscape(photos[i]) && i + 1 < photos.length && !isLandscape(photos[i + 1])) {
      rows.push([i, i + 1]);
      i += 2;
    } else {
      rows.push([i]);
      i += 1;
    }
  }
  return rows;
}

export default function Gallery({ photos, layout = "masonry", hero = true, showProject = false }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  // Featured photo = first landscape one (a full-width portrait would be enormous)
  const heroIndex = layout === "masonry" && hero ? photos.findIndex(isLandscape) : -1;

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
      {layout === "stack" ? (
        stackRows(photos).map((row) => {
          const kind = row.length === 2 ? "pair" : isLandscape(photos[row[0]]) ? "wide" : "single";
          return (
            <div key={row.join("-")} className={`stack-row ${kind}`}>
              {row.map((i) => fig(photos[i], i, kind === "wide" ? HERO_SIZES : "(min-width:1500px) 718px, 50vw"))}
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
