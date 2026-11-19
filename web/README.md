# Sharath Satish

A personal website built with [Astro](https://astro.build) and React. Right now it holds a photography portfolio; the plan is to add a blog later (tech, everyday life, photography and more).

## Site map

| URL | What it is |
|---|---|
| `/` | **Landing page**: a panoramic photo in an off-white frame, a line of text and a green squiggle. |
| `/photography` | **Highlights**: photos picked by hand across all collections. |
| `/photography/collections` | **Collections**: a two-per-row grid of collections. |
| `/photography/collections/<name>` | One collection. |
| `/photography/gear` | **Gear**: the cameras and lenses I shoot with, in two sections. |
| `/about` | Portrait and short bio (about the person, so it sits outside Photography). |

Old URLs still work: `/collections/...` and the earlier `/projects/...` redirect to `/photography/collections/...`.

The top bar has **Photography** and **About**. Pages inside Photography also show **Highlights | Collections | Gear** tabs under it. A future blog would be another top-level section next to Photography.

### What each page looks like

- **Highlights** (`/photography`): photos picked by hand across all collections, with the first photo full-width, then a two-column masonry grid (list order reads left to right).
- **Collections** (`/photography/collections`): a two-per-row grid of collections, each with its own page (`/photography/collections/<name>`).
- **Collection page**: a full-width lead photo, then a three-column grid where every photo keeps its own proportions.
- **Gear** (`/photography/gear`): two sections, Cameras and Lenses, each a grid of cards with a square photo, the name and a short detail line.
- **Full-screen view**: click any photo. It works for landscape and portrait, with arrow-key / swipe navigation. Under the photo it always shows the title, the camera settings (see "Camera settings (EXIF)" below), and the photo's top three colours as small squares (click one to copy its hex code) next to the counter.
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
- `file`, `w`, `h`, `widths`, `v`, `colors`, `blur`, `exif`: **written by `npm run photos`.** Don't hand-edit.
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

Layout: the Highlights page uses `HIGHLIGHTS_LAYOUT` at the top of `src/pages/photography/index.astro`. Two options:

- `"columns"` (current): the first photo in the list runs full-width (only if it is a landscape; otherwise there is no banner), then a two-column masonry. Each photo goes into whichever column is currently shorter, so the list reads left to right across the page and the columns end at about the same height. Photos keep their natural proportions.
- `"stack"`: two per row. Neighbouring photos of the same shape (landscape + landscape, or portrait + portrait; squares count as portraits) share a row at equal height, so rows line up and nothing is cropped. A photo with no same-shaped neighbour sits alone, centred at half width. To avoid lone photos, arrange the list so same-shaped photos come in even-sized runs.

In both, the list order is never changed. (The collection pages use a different layout: a full-width lead photo, then a three-column CSS masonry.)

## Camera settings (EXIF)

`npm run photos` reads each original's EXIF and saves a short, safe summary as `exif` in the collection's data file. The full-screen view shows it as one line, for example:

> Fujifilm X-E4 · XF 16-50mm f/2.8-4.8 R LM WR · 47mm · f/7.1 · 1/220s · ISO 640 · +0.7 EV

- **What is kept:** camera, lens, focal length, aperture, shutter speed, ISO, and exposure compensation (only if not zero). The date taken is also saved but not displayed. **Nothing else is copied: no GPS location, serial numbers or owner names.** (The resized website copies have all EXIF removed too.) A photo whose EXIF lacks something simply omits that part. (The 35mm-equivalent focal length is still saved as `focal35` in the data files but is not displayed; to show it again, see `exifParts` in `src/lib/exif.ts`.)
- **Film scans:** a lab scanner's EXIF names the scanner, not your camera, and has no exposure data. Those photos show `Canon AT-1 · Scanned film` instead. The camera name comes from `FILM_SCAN_CAMERA` in `.env` (default `Canon AT-1`), and a photo counts as a scan when its EXIF is from a scanner (Noritsu and similar) with no lens recorded.
- **When it is read:** once per photo, when it is first processed. Changing `EXIF_VERSION` in `scripts/photos.mjs` re-reads every photo's EXIF without re-encoding any images (about a second for hundreds of photos).
- **Date taken** is saved in the data files (as `date`, exactly as the camera wrote it) but not shown. To show it again, add it back to `exifParts` in `src/lib/exif.ts`.
- The reader (`exifr`) is given the first 512 KB of each file rather than the file path, because its own file handling errors out on Node 26.

## Updating the Gear page

Gear is not a collection. Its photos go in the reserved folder **`photos/gear/`**, and `npm run photos` handles it separately (same resizing, but it never creates a collection and never shows up on the Collections page).

1. **Add a photo:** put it in `photos/gear/`, for example `photos/gear/X-T5.jpg`, and run `npm run photos`. A photo's key is its file name in lowercase without the extension (`X-T5.jpg` becomes `x-t5`).
2. **Add or edit an entry** in `src/data/gear.json`, under `"cameras"` or `"lenses"`:

```json
{ "name": "Fujifilm X-E4", "detail": "Mirrorless · APS-C", "note": "", "photo": "x-e4" }
```

- `name`: shown under the photo. `detail`: small line below it. `note`: an optional sentence, hidden when empty. `photo`: the key from step 1 (optional; an entry without a photo shows a grey block).
- Entries appear in the order listed, three per row on desktop.
- `src/data/gear-images.json` is written by the script (sizes, blur preview). Don't edit it.

## Where photos are served from

All image URLs go through `src/lib/images.ts`:

- **`PUBLIC_IMAGE_BASE` unset:** generated placeholder art.
- **`PUBLIC_IMAGE_BASE=/img`:** local dev. `public/img` is a link to `.cache/images`.
- **`PUBLIC_IMAGE_BASE=https://img.<your-domain>`:** production. Photos load from `{base}/{collection}/{file}-{width}.webp?v={hash}`. Files are cached for a year, and the `v` hash makes a replaced photo get a new URL.

Copy `.env.example` to `.env` and fill it in. It holds `PUBLIC_IMAGE_BASE` and the R2 keys (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`). `.env` is gitignored.

## Deploying

The site is static: Cloudflare Pages builds it from this GitHub repo, and the photos are served separately from an R2 bucket on your own subdomain.

**Live setup**
- **Photos:** R2 bucket with the custom domain `images.sharathsatish.me`. All photo copies are uploaded (`npm run photos:upload` skips anything already there).
- **Site:** Cloudflare Pages project connected to the GitHub repo `Sharath04Satish/my-space`.
- **Addresses:** `https://sharathsatish.me` and `https://www.sharathsatish.me` are both attached to the Pages project (Custom domains), and the default `https://my-space-6c7.pages.dev` also works. Cloudflare manages their DNS records. Add a domain through the Pages "Custom domains" screen and let it create the record; creating the record by hand first can give a 522 error. `images.sharathsatish.me` belongs to the R2 bucket, so leave it alone.
- **A new address "can't be found" on your own computer** right after you add it: the computer remembered "that doesn't exist" from an earlier lookup (up to about 30 minutes). Check it from your phone on mobile data. To clear it on a Mac: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`, then restart the browser.

**Cloudflare Pages build settings**

| Setting | Value |
|---|---|
| Root directory | `web` (the app lives in a subfolder of the repo) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variable | `PUBLIC_IMAGE_BASE` = `https://images.sharathsatish.me` (no trailing slash) |
| Environment variable | `NODE_VERSION` = `22` (`web/.nvmrc` says the same) |

`PUBLIC_IMAGE_BASE` is baked into the pages when they are built, so changing it needs a rebuild (Pages > Deployments > Retry, or push a commit).

**Day to day:** add photos to `photos/<collection>/`, run `npm run photos:sync`, commit the changed data files in `src/data/`, and push. Pages rebuilds and publishes by itself.

**What goes where:** the repo holds only code and the small data files; originals (`photos/`) and generated copies (`.cache/`) never go to GitHub, and `.env` (with the R2 keys) is gitignored. The built site is about 2 MB. The repo is public, so anything committed is public.

**Files that exist for deployment**
- `web/.nvmrc`: Node version for the host.
- `web/src/pages/404.astro`: the "Page not found" page. Without one, Cloudflare Pages treats the site as a single-page app and shows the home page for every bad address.
- `web/public/_headers`: caches the built CSS and JS for a year.
- `web/public/robots.txt`: allows search engines.
- `site` in `web/astro.config.mjs`: the site's own address (`https://sharathsatish.me`).
- Old addresses (`/collections/...`, `/projects/...`) forward to `/photography/collections/...`.

**Checking a build before pushing:** `PUBLIC_IMAGE_BASE=https://images.sharathsatish.me npm run build`, then `npm run preview`. The local preview link `public/img` is only created when `PUBLIC_IMAGE_BASE` starts with `/`, so a normal build stays small.

## Project layout

```text
photos/                 your originals (gitignored, never deployed); photos/gear/ is reserved for the Gear page
.cache/                 generated web copies and upload state (gitignored)
scripts/photos.mjs      the photo pipeline (build / upload / sync)
src/
  pages/                index (landing page), about,
                        photography/ (index = highlights, collections/, gear)
  components/           Gallery.tsx, Lightbox.tsx, ProjectCards.astro
  layouts/Layout.astro  header, footer, page transitions
  lib/                  data.ts (loads the JSON), gear.ts, images.ts (URLs), colors.ts
  data/                 highlights.json, projects/*.json, gear.json (+ generated gear-images.json)
  assets/about.jpg      the About page portrait
  styles/global.css     all styling (colours are variables at the top)
```

## Mobile

The site is built phone-first in its details (all of this lives in `src/styles/global.css`, in the blocks marked "phones", "touch screens" and "mouse/trackpad only"):

- **Breakpoints:** layouts switch to their phone form at 720px wide and below; very small phones (under 360px) get a slightly tighter header.
- **Type scale (phones):** text is deliberately small so the photos get the screen: page titles 22-26px, body text 13-14px, labels and captions 10-11px, and tight spacing around the title block. This put the first photo about 21-26% of the way down the screen instead of 28-35%. The phone type sizes are all in the single `@media (max-width:720px)` block ("phones") in `src/styles/global.css`, so changing one number there changes it everywhere; desktop sizes are untouched.
- **Tap targets:** on any touch screen (phones *and* tablets) the logo, main nav and Photography tabs are at least 44px tall, the size Apple and Google recommend for fingers. The three colour squares in the full-screen view grow to 28px.
- **Hover only for mouse users:** the zoom-on-hover and caption effects only apply when the device really has hover (`(hover:hover)`). On a phone they would otherwise stick after a tap.
- **Notch and home indicator:** the page uses `viewport-fit=cover` and `env(safe-area-inset-*)` so the header, footer and full-screen view clear the status bar, notch and home bar. (Desktop browsers and the in-app preview report zero insets, so this can only be seen on a real notched phone.)
- **Phone layouts:** the Highlights and collection photo grids are one photo per row, each the full width of the screen, in the same order as on desktop (the Highlights' two desktop columns are flattened back into list order with CSS `order`). Gear is two per row, About has a square portrait with a tappable (`mailto:`) email, and the lead photo and photo grids sit tighter under the header.
- **Header on phones:** it scrolls away with the page instead of staying pinned (on desktop and tablets it stays pinned), so photos get the whole screen while you scroll. Scroll back to the top, or tap the status bar on an iPhone, to reach the navigation again.
- **Sideways phones / short windows (under 500px tall):** the header is not pinned either, and the full-screen view uses a compact one-row footer, so the photo gets about 80% of the screen height.
- **Full-screen view gestures:** swipe left/right for the next/previous photo, swipe down to close, and a two-finger pinch is left to the browser so you can zoom into detail. Arrow keys and Esc still work on desktop.
- **Loading:** each photo's tiny blur preview is painted on its frame (so there is never a blank gap), and the sharp photo fades in over it. The theme colour of the phone's browser bar is set to white.
- **Reduced motion:** visitors who ask their device for less motion get no fades, zooms or the squiggle animation.

## Good to know

- **Navigation** between pages uses Astro's client-side router and hover prefetching, so tab switches don't reload the page.
- **The landing page** (`src/pages/index.astro`) shows one photo in a CSS "photo frame" (off-white border, thin edge, soft shadow), the sentence below it, and an SVG green squiggle that draws itself in on load (disabled for visitors who prefer reduced motion). **It has two photos:** a panorama for desktop and tablets, and a tall photo for phones (720px wide and below), chosen with a `<picture>` element so each device downloads only its own. To change them, edit the `DESKTOP` and `PHONE` values at the top of the file (collection folder name + photo file name). The two share one alt text ("A featured photograph by Sharath Satish"), because a `<picture>` can only have one. The text is the `.tagline` paragraph; the frame colour and squiggle green are `#f4efe3` and `#4a8c58` in the same file's `<style>`. The logo links to `/`.
- **Adding a section** (for example a blog): create `src/pages/<section>/`, add it to the top nav and the `active` type in `src/layouts/Layout.astro`. The Highlights | Collections tabs only appear on Photography pages.
- **The About photo** (`src/assets/about.jpg`) is resized by Astro at build time and cropped to a tall frame around the face. Replace the file to change it.
- **Collections with no photos yet** show a grey cover and "Photos coming soon."

## Status and what's next

- All 11 collections now have photos.
- **Not yet done:** the R2 upload has been exercised only with `--dry-run`, never against a real bucket. There is no deployment set up yet (Cloudflare Pages is the plan). The contact line on the About page is still a placeholder, and the Instagram / Email links in the footer don't go anywhere yet. Very long collections would benefit from loading photos as you scroll.
