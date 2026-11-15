# Sharath Satish — Photography

A personal photography portfolio built with [Astro](https://astro.build) and React.

- **Highlights** (`/`): photos picked by hand across all collections. Landscapes run full-width; portraits sit two per row.
- **Collections** (`/collections`): a two-per-row grid of collections, each with its own page (`/collections/<name>`).
- **Collection page**: a full-width lead photo, then a three-column grid where every photo keeps its own proportions.
- **Full-screen view**: click any photo. It works for landscape and portrait, with arrow-key / swipe navigation, and shows the photo's top three colours as small squares (click one to copy its hex code).
- **About** (`/about`): portrait and short bio.

Full-resolution originals never go on the site. A script makes web-sized copies, which are stored on Cloudflare R2.

## Running it

Requires Node 22.23.4 or newer. Commands run from this folder.

| Command | What it does |
|---|---|
| `npm install` | Install dependencies (first time only) |
| `npx astro dev --background` | Start the dev server at http://localhost:4321 |
| `npx astro dev stop` / `status` / `logs` | Manage that background server |
| `npm run build` | Build the production site into `dist/` |
| `npm run preview` | Serve the production build (stop with Ctrl+C) |

Judge speed on `npm run build && npm run preview`. The dev server loads many more files than the real site does.

## Adding photos

1. **Put originals in a collection folder:** `photos/<collection-name>/`. Export JPEGs from Lightroom at any size, sRGB. Folder names are the collection's URL name (for example `the-land-of-14ers`).
2. **Process them:** `npm run photos`
   - Makes 600 / 1200 / 2400px-wide WebP copies (smaller originals get fewer sizes) in `.cache/images/`.
   - Records each photo's size, its three dominant colours and a tiny blur preview in the collection's data file.
   - Only new or changed photos are processed, so re-running is cheap.
   - Fixes EXIF rotation and strips EXIF data, including GPS location, from the copies. Originals are never touched.
3. **Edit the data file** `src/data/projects/<collection-name>.json` (see below). Your edits are kept on later runs.
4. **Upload to R2:** `npm run photos:upload` sends only files R2 doesn't have yet (add `-- --dry-run` to preview). `npm run photos:sync` does steps 2 and 4 together.
5. **Deploy** the site (not set up yet, see below).

Removing a photo from its folder and re-running `npm run photos` also removes it from the data file and from `.cache/`.

## Collection data

One file per collection in `src/data/projects/`. (The folder keeps its old "projects" name; the site calls them collections.)

```json
{
  "slug": "the-land-of-enchantment",
  "title": "The Land of Enchantment",
  "place": "New Mexico",
  "year": 2026,
  "order": 7,
  "cover": "dscf0513",
  "blurb": "",
  "photos": [
    { "file": "dscf0470", "title": "Dscf0470", "w": 6240, "h": 2606, "widths": [600, 1200, 2400], "v": "ab12cd34", "colors": ["#6787a4"], "blur": "data:image/webp;base64,..." }
  ]
}
```

- `title`, `place`, `year`, `blurb`, `order`, `cover` and each photo's `title`: **yours to edit.**
- `order`: position on the Collections page (1 first). Collections without one sort newest first after the numbered ones.
- `cover`: the photo's `file` name to use as the collection's cover on the Collections page. Default: the first photo.
- `blurb`: one line under the title on the collection page. Hidden if empty.
- `photos`: shown in this order. Reorder by moving entries. The lead photo on a collection page is the first *landscape* one in the list.
- `file`, `w`, `h`, `widths`, `v`, `colors`, `blur`: **written by `npm run photos`.** Don't hand-edit.
- A photo's `file` is its filename in lowercase with anything that isn't a letter or number turned into a dash, minus the extension: `DSCF1278-2.jpg` becomes `dscf1278-2`.

To add a new collection, create `photos/<new-name>/`, add photos, and run `npm run photos`. It creates the data file, then set its `title`, `place`, `year` and `order`.

## Choosing highlights

`src/data/highlights.json` lists the photos on the home page, in display order:

```json
[
  { "project": "and-it-was-all-yellow", "file": "dscf1520" },
  { "project": "the-golden-state", "file": "dscf8331" }
]
```

`project` is the collection's folder / URL name (the field keeps its old name). An entry that doesn't match a real photo is silently skipped, so check the page after saving.

Layout rules: a landscape photo gets its own full-width row. Two portraits in a row (squares count as portraits) share a row at equal height. A portrait with a landscape on both sides sits centred at half width. List order is never changed to make pairs.

## Where photos are served from

All image URLs go through `src/lib/images.ts`:

- **`PUBLIC_IMAGE_BASE` unset:** generated placeholder art.
- **`PUBLIC_IMAGE_BASE=/img`:** local dev. `public/img` is a link to `.cache/images`.
- **`PUBLIC_IMAGE_BASE=https://img.<your-domain>`:** production. Photos load from `{base}/{collection}/{file}-{width}.webp?v={hash}`. Files are cached for a year, and the `v` hash makes a replaced photo get a new URL.

Copy `.env.example` to `.env` and fill it in. It holds `PUBLIC_IMAGE_BASE` and the R2 keys (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`). `.env` is gitignored.

## Project layout

```text
photos/                 your originals (gitignored, never deployed)
.cache/                 generated web copies and upload state (gitignored)
scripts/photos.mjs      the photo pipeline (build / upload / sync)
src/
  pages/                index (highlights), collections/, about
  components/           Gallery.tsx, Lightbox.tsx, ProjectCards.astro
  layouts/Layout.astro  header, footer, page transitions
  lib/                  data.ts (loads the JSON), images.ts (URLs), colors.ts
  data/                 highlights.json and projects/*.json
  assets/about.jpg      the About page portrait
  styles/global.css     all styling (colours are variables at the top)
```

## Good to know

- **Navigation** between pages uses Astro's client-side router and hover prefetching, so tab switches don't reload the page. `/projects/...` URLs redirect to `/collections/...`.
- **The About photo** (`src/assets/about.jpg`) is resized by Astro at build time and cropped to a tall frame around the face. Replace the file to change it.
- **Collections with no photos yet** show a grey cover and "Photos coming soon."

## Status and what's next

- Collections with photos: And it was all Yellow, These Mountains Narrate Stories, The Land of Enchantment, The Land of 14ers, The Golden State.
- Still empty: The Canyons, The Big 5, The Least Populated State in the US, From the sets of Madagascar, City and Architecture, The Evergreen State.
- **Not yet done:** the R2 upload has been exercised only with `--dry-run`, never against a real bucket. There is no deployment set up yet (Cloudflare Pages is the plan). The contact line on the About page is still a placeholder, and the Instagram / Email links in the footer don't go anywhere yet. Very long collections would benefit from loading photos as you scroll.
