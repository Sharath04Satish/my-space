import gearJson from "../data/gear.json";
import gearImages from "../data/gear-images.json";
import type { Photo } from "./images";

/** One camera or lens on the Gear page. Edit these in src/data/gear.json. */
export type GearItem = {
  name: string;
  /** short line under the name, e.g. "Mirrorless · APS-C" */
  detail?: string;
  /** optional longer sentence; shown only if filled in */
  note?: string;
  /** file name (lowercase, no extension) of a photo in photos/gear/, e.g. "x-e4" for X-E4.jpeg. Optional. */
  photo?: string;
};

type RawItem = GearItem;
type ImageInfo = Omit<Photo, "file" | "title">;

/** Images are served from the "gear" folder under PUBLIC_IMAGE_BASE (see src/lib/images.ts) */
export const GEAR_FOLDER = "gear";

const images = gearImages as Record<string, ImageInfo>;

const withPhoto = (item: RawItem) => {
  const info = item.photo ? images[item.photo] : undefined;
  const photo: Photo | undefined = info ? { file: item.photo!, title: item.name, ...info } : undefined;
  return { ...item, photo };
};

export const cameras = (gearJson.cameras as RawItem[]).map(withPhoto);
export const lenses = (gearJson.lenses as RawItem[]).map(withPhoto);
