#!/usr/bin/env node
/**
 * Photo pipeline.
 *
 *   npm run photos           resize new/changed originals, extract colours, update manifests
 *   npm run photos:upload    upload generated files that R2 doesn't have yet
 *   npm run photos:sync      both
 *   add --dry-run to upload to see what would be sent
 *
 * Layout:
 *   photos/<project>/*.jpg        your originals (gitignored, never deployed)
 *   .cache/images/<project>/      generated WebP variants (gitignored; uploaded to R2)
 *   src/data/projects/<project>.json   manifest (committed). Titles/blurb you edit are preserved.
 *
 *   photos/gear/*.jpg             RESERVED for the Gear page. Same resizing, but no collection is created:
 *                                 image info goes to src/data/gear-images.json (generated, don't edit).
 *                                 Names/details are in src/data/gear.json (yours to edit).
 *
 * Re-runs are incremental: a file is only processed again if its size or mtime changed
 * (and then only re-encoded if its content hash changed).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import exifr from "exifr";

const PHOTOS = path.resolve(process.env.PHOTOS_DIR ?? "photos");
const OUT = path.resolve(process.env.IMAGES_DIR ?? ".cache/images");
const MANIFESTS = path.resolve(process.env.MANIFEST_DIR ?? "src/data/projects");
const STATE_FILE = path.join(path.dirname(OUT), "state.json");
// photos/gear/ is reserved for the Gear page (cameras, lenses). It never becomes a collection.
const GEAR = "gear";
// Camera to show for film scans (their EXIF only names the lab scanner, not your camera). Override with FILM_SCAN_CAMERA in .env.
const FILM_SCAN_CAMERA = process.env.FILM_SCAN_CAMERA ?? "Canon AT-1";
// Bump to re-read EXIF for every photo (cheap: it never re-encodes images)
const EXIF_VERSION = 1;
const GEAR_IMAGES = path.resolve(process.env.GEAR_IMAGES_FILE ?? "src/data/gear-images.json");

const WIDTHS = [600, 1200, 2400]; // keep in sync with src/lib/images.ts
const QUALITY = 82;
const EXT = new Set([".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp", ".avif"]);
const SETTINGS = `w${WIDTHS.join("-")}q${QUALITY}`; // bump-proof: changing settings re-encodes everything
const CONCURRENCY = 3;

const args = process.argv.slice(2);
const cmd = args.find((a) => !a.startsWith("--")) ?? "build";
const dry = args.includes("--dry-run");

// ---------- helpers ----------
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const titleCase = (s) => s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return fallback; } };
const writeJson = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 2) + "\n"); };

function hashFile(f) {
  return new Promise((res, rej) => {
    const h = crypto.createHash("sha1");
    fs.createReadStream(f).on("data", (d) => h.update(d)).on("end", () => res(h.digest("hex"))).on("error", rej);
  });
}

async function pool(items, n, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: n }, async () => { while (queue.length) await fn(queue.shift()); }));
}

/** Up to n visibly distinct dominant colours from a small raw RGB buffer. */
function topColors(data, n = 3) {
  const bins = new Map();
  for (let i = 0; i < data.length; i += 3) {
    const k = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const b = bins.get(k) ?? [0, 0, 0, 0];
    b[0]++; b[1] += data[i]; b[2] += data[i + 1]; b[3] += data[i + 2];
    bins.set(k, b);
  }
  const ranked = [...bins.values()].sort((a, b) => b[0] - a[0]).map((b) => [b[1] / b[0], b[2] / b[0], b[3] / b[0]].map(Math.round));
  const out = [];
  for (const t of [60, 36, 18, 0]) {
    for (const c of ranked) {
      if (out.length >= n) break;
      if (!out.includes(c) && out.every((o) => Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2]) > t)) out.push(c);
    }
  }
  return out.map((c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join(""));
}

// ---------- EXIF ----------
/**
 * Read a short, safe list of camera settings from an original. Only these fields are ever kept:
 * location (GPS), serial numbers, owner names etc. are deliberately NOT copied anywhere.
 * Reads just the head of the file (EXIF lives there) and parses from memory; exifr's own file
 * handling errors out on Node 26 ("FileHandle closed during garbage collection").
 */
const EXIF_TAGS = ["Make", "Model", "LensModel", "FocalLength", "FocalLengthIn35mmFormat", "FNumber", "ExposureTime", "ISO", "DateTimeOriginal", "ExposureCompensation"];

function head(file, bytes = 512 * 1024) {
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(Math.min(bytes, fs.fstatSync(fd).size));
    fs.readSync(fd, buf, 0, buf.length, 0);
    return buf;
  } finally {
    fs.closeSync(fd);
  }
}

const prettyMake = (m) => (m && m === m.toUpperCase() ? m[0] + m.slice(1).toLowerCase() : m);
/** "XF16-50mmF2.8-4.8 R LM WR" -> "XF 16-50mm f/2.8-4.8 R LM WR"; drops a redundant "Fujifilm Fujinon " prefix */
const prettyLens = (l) =>
  l
    .replace(/^Fujifilm\s+Fujinon\s+/i, "")
    .replace(/^(X[CF])(\d+(?:-\d+)?mm)F([\d.]+(?:-[\d.]+)?)/, "$1 $2 f/$3")
    .trim();
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

async function readExif(file) {
  let t;
  try {
    t = await exifr.parse(head(file), { pick: EXIF_TAGS, reviveValues: true });
  } catch {
    return null;
  }
  if (!t || !(t.Make || t.Model)) return null;

  // Lab scanners (Noritsu etc.) describe the scanner, not the camera: show your film camera instead.
  if (/noritsu|frontier|fujifilm sp|scanner/i.test(`${t.Make ?? ""} ${t.Model ?? ""}`) && !t.LensModel) {
    return { camera: FILM_SCAN_CAMERA, film: true };
  }

  const make = prettyMake(t.Make);
  const model = t.Model ?? "";
  const out = {};
  out.camera = model.toLowerCase().startsWith((make ?? "").toLowerCase()) || !make ? model : `${make} ${model}`;
  if (t.LensModel) out.lens = prettyLens(String(t.LensModel));
  if (t.FocalLength) out.focal = round(t.FocalLength, 0);
  if (t.FocalLengthIn35mmFormat) out.focal35 = round(t.FocalLengthIn35mmFormat, 0);
  if (t.FNumber) out.f = round(t.FNumber, 1);
  if (t.ExposureTime) out.shutter = t.ExposureTime >= 1 ? `${round(t.ExposureTime, 1)}s` : `1/${Math.round(1 / t.ExposureTime)}s`;
  if (t.ISO) out.iso = t.ISO;
  if (typeof t.ExposureCompensation === "number" && Math.abs(t.ExposureCompensation) >= 0.05) out.ev = round(t.ExposureCompensation, 1);
  // Cameras store local time with no time zone; exifr labels it UTC, so take the date as written (no shifting)
  if (t.DateTimeOriginal instanceof Date && !Number.isNaN(+t.DateTimeOriginal)) out.date = t.DateTimeOriginal.toISOString().slice(0, 10);
  return out;
}

// ---------- processing one original ----------
async function processOne(src, project, name, hash) {
  const meta = await sharp(src, { failOn: "none" }).metadata();
  const swap = (meta.orientation ?? 1) >= 5;
  const w = swap ? meta.height : meta.width, h = swap ? meta.width : meta.height;

  // .rotate() applies EXIF orientation and (by omitting withMetadata) strips EXIF incl. GPS from outputs
  const base = () => sharp(src, { failOn: "none" }).rotate();

  const { data } = await base().resize(48, 48, { fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const colors = topColors(data);
  const blurBuf = await base().resize(24).webp({ quality: 40 }).toBuffer();
  const blur = "data:image/webp;base64," + blurBuf.toString("base64");

  const widths = WIDTHS.filter((x) => x < w);
  if (!widths.length || w < WIDTHS[WIDTHS.length - 1]) widths.push(Math.min(w, WIDTHS[WIDTHS.length - 1]));
  const widthsUniq = [...new Set(widths)].sort((a, b) => a - b);

  fs.mkdirSync(path.join(OUT, project), { recursive: true });
  const outputs = [];
  for (const width of widthsUniq) {
    const rel = `${project}/${name}-${width}.webp`;
    await base().resize({ width, withoutEnlargement: true }).webp({ quality: QUALITY, effort: 5 }).toFile(path.join(OUT, rel));
    outputs.push({ key: rel, width, id: `${hash}:${SETTINGS}` });
  }
  return { w, h, colors, blur, widths: widthsUniq, v: hash.slice(0, 8), outputs };
}

// ---------- build ----------
async function build() {
  if (!fs.existsSync(PHOTOS)) {
    console.log(`No photos folder at ${PHOTOS}\nCreate it and add  photos/<project-name>/your-photo.jpg`);
    return;
  }
  const state = readJson(STATE_FILE, { sources: {}, uploaded: {} });
  const projects = fs.readdirSync(PHOTOS, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith("."));
  const seen = new Set();
  let processed = 0, reused = 0, exifRead = 0;

  for (const dir of projects) {
    const slug = slugify(dir.name);
    const files = fs.readdirSync(path.join(PHOTOS, dir.name)).filter((f) => EXT.has(path.extname(f).toLowerCase())).sort();
    const jobs = [];

    for (const f of files) {
      const src = path.join(PHOTOS, dir.name, f);
      const name = slugify(path.basename(f, path.extname(f)));
      const rel = `${slug}/${name}`;
      seen.add(rel);
      const st = fs.statSync(src);
      const prev = state.sources[rel];
      const unchanged = prev && prev.size === st.size && prev.mtimeMs === st.mtimeMs && prev.settings === SETTINGS &&
        prev.outputs.every((o) => fs.existsSync(path.join(OUT, o.key)));
      if (unchanged) { reused++; continue; }
      jobs.push({ src, name, rel, st, prev });
    }

    await pool(jobs, CONCURRENCY, async ({ src, name, rel, st, prev }) => {
      const hash = await hashFile(src);
      if (prev && prev.hash === hash && prev.settings === SETTINGS && prev.outputs.every((o) => fs.existsSync(path.join(OUT, o.key)))) {
        state.sources[rel] = { ...prev, size: st.size, mtimeMs: st.mtimeMs }; // touched but identical
        reused++; return;
      }
      const t0 = Date.now();
      const r = await processOne(src, slug, name, hash);
      state.sources[rel] = { size: st.size, mtimeMs: st.mtimeMs, hash, settings: SETTINGS, project: slug, name, ...r };
      processed++;
      console.log(`  ✓ ${rel}  ${r.w}×${r.h}  ${r.widths.join("/")}px  ${r.colors.join(" ")}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    });

    // ----- the reserved "gear" folder is not a collection: record image info for the Gear page and move on -----
    if (slug === GEAR) {
      const images = {};
      for (const f of files) {
        const n = slugify(path.basename(f, path.extname(f)));
        const s = state.sources[`${slug}/${n}`];
        images[n] = { w: s.w, h: s.h, widths: s.widths, v: s.v, blur: s.blur };
      }
      writeJson(GEAR_IMAGES, images);
      console.log(`${slug}: ${files.length} gear photo(s)  (not a collection; names and details live in src/data/gear.json)`);
      continue;
    }

    // ----- EXIF: read once per photo (and again whenever EXIF_VERSION changes); never touches the image copies -----
    for (const f of files) {
      const n = slugify(path.basename(f, path.extname(f)));
      const s = state.sources[`${slug}/${n}`];
      if (s && s.exifV !== EXIF_VERSION) {
        s.exif = await readExif(path.join(PHOTOS, dir.name, f));
        s.exifV = EXIF_VERSION;
        exifRead++;
      }
    }

    // ----- manifest: keep your edits (titles, blurb...), add new photos, drop removed ones -----
    const mf = path.join(MANIFESTS, `${slug}.json`);
    const existing = readJson(mf, null);
    const meta = existing ?? { slug, title: titleCase(dir.name), place: "", year: new Date().getFullYear(), blurb: "", photos: [] };
    const byName = new Map((meta.photos ?? []).map((p) => [p.file, p]));
    const onDisk = files.map((f) => slugify(path.basename(f, path.extname(f))));
    const kept = (meta.photos ?? []).filter((p) => onDisk.includes(p.file)).map((p) => p.file);
    const added = onDisk.filter((n) => !kept.includes(n));
    meta.photos = [...kept, ...added].map((n) => {
      const s = state.sources[`${slug}/${n}`];
      const old = byName.get(n);
      return { file: n, title: old?.title ?? titleCase(n), w: s.w, h: s.h, widths: s.widths, v: s.v, colors: s.colors, blur: s.blur, ...(s.exif ? { exif: s.exif } : {}) };
    });
    writeJson(mf, meta);
    console.log(`${slug}: ${meta.photos.length} photos${added.length ? ` (${added.length} new)` : ""}${existing ? "" : "  ← new manifest, edit title/place/blurb in " + path.relative(process.cwd(), mf)}`);
  }

  // prune sources that no longer exist on disk
  for (const rel of Object.keys(state.sources)) {
    if (seen.has(rel)) continue;
    for (const o of state.sources[rel].outputs) fs.rmSync(path.join(OUT, o.key), { force: true });
    delete state.sources[rel];
    console.log(`  removed ${rel}`);
  }

  writeJson(STATE_FILE, state);

  // local serving: public/img -> .cache/images, so PUBLIC_IMAGE_BASE=/img works in dev (only created when that is the setting)
  const link = path.resolve("public/img");
  if (!fs.existsSync(link) && OUT === path.resolve(".cache/images") && (process.env.PUBLIC_IMAGE_BASE ?? "").startsWith("/")) {
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.mkdirSync(OUT, { recursive: true });
    fs.symlinkSync(path.relative(path.dirname(link), OUT), link);
  }
  console.log(`\nDone: ${processed} processed, ${reused} unchanged${exifRead ? `, EXIF read for ${exifRead}` : ""}.`);
  if (processed && !process.env.PUBLIC_IMAGE_BASE) console.log('Tip: set PUBLIC_IMAGE_BASE=/img in .env to see these locally (see .env.example).');
}

// ---------- upload to R2 (S3-compatible) ----------
async function upload() {
  const state = readJson(STATE_FILE, null);
  if (!state) return console.log("Nothing built yet. Run: npm run photos");
  const todo = Object.values(state.sources).flatMap((s) => s.outputs).filter((o) => state.uploaded[o.key] !== o.id);
  const bytes = todo.reduce((a, o) => a + fs.statSync(path.join(OUT, o.key)).size, 0);
  console.log(`${todo.length} file(s) to upload (${(bytes / 1e6).toFixed(1)} MB)`);
  if (dry || !todo.length) { if (dry) todo.slice(0, 20).forEach((o) => console.log("  would upload", o.key)); return; }

  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (![R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET].every(Boolean)) {
    console.error("Missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET (see .env.example)");
    process.exit(1);
  }
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  let n = 0;
  await pool(todo, 8, async (o) => {
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: o.key,
      Body: fs.readFileSync(path.join(OUT, o.key)),
      ContentType: "image/webp",
      // URLs carry ?v=<hash>, so a changed photo gets a new URL: safe to cache forever
      CacheControl: "public, max-age=31536000, immutable",
    }));
    state.uploaded[o.key] = o.id;
    if (++n % 25 === 0) writeJson(STATE_FILE, state); // checkpoint so an interrupted upload resumes
  });
  writeJson(STATE_FILE, state);
  console.log(`Uploaded ${n} file(s).`);
}

if (cmd === "build") await build();
else if (cmd === "upload") await upload();
else if (cmd === "sync") { await build(); await upload(); }
else { console.error(`Unknown command "${cmd}". Use: build | upload | sync`); process.exit(1); }
