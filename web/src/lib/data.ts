import type { GalleryPhoto, Photo } from "./images";
import highlightsJson from "../data/highlights.json";

export type Project = {
  slug: string;
  title: string;
  place: string;
  year: number;
  /** Position on the Collections page (1 = first). Collections without one sort newest-first after these. */
  order?: number;
  /** `file` of the photo used as this collection's cover on the Collections page (default: first photo) */
  cover?: string;
  blurb: string;
  photos: Photo[];
};

const modules = import.meta.glob<Project>("../data/projects/*.json", { eager: true, import: "default" });

/** By `order` if set, otherwise newest first, then alphabetical */
export const projects: Project[] = Object.values(modules).sort(
  (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || b.year - a.year || a.title.localeCompare(b.title),
);

export const getProject = (slug: string) => projects.find((p) => p.slug === slug)!;

export const toGallery = (p: Project): GalleryPhoto[] =>
  p.photos.map((ph) => ({ ...ph, project: p.slug, projectTitle: p.title }));

/** Hand-picked photos across projects, in the order listed in src/data/highlights.json */
export const highlights: GalleryPhoto[] = (highlightsJson as { project: string; file: string }[]).flatMap(({ project, file }) => {
  const p = projects.find((x) => x.slug === project);
  const ph = p?.photos.find((x) => x.file === file);
  return p && ph ? [{ ...ph, project: p.slug, projectTitle: p.title }] : [];
});
