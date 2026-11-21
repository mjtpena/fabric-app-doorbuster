/**
 * Geometry of the midnight arcade, in SVG user units. Two floors of storefront blocks (one block per category, one
 * shop window per deal) under a glass fanlight, with the arcade clock across the top. Pure, so it is unit-tested.
 */
import { CATEGORIES, type Category } from '../model';

export const WIN_W = 92;
export const PAD = 8;
export const COL = 18;
export const SCENE_MIN_W = 1000;
export const SCENE_H = 760;

/** Desktop: the clock hangs in the fanlight, right of the title panel and under the top-right controls. */
export const CLOCK = { y: 100, h: 46, x0: 470 };
/** Top of the visible scene: desktop keeps a strip of fanlight; phones crop to the facade (the clock is an overlay). */
export const VIEW_Y0 = { desktop: 20, phone: 92 };
export const FACADE_Y = 156;

export interface FloorGeom {
  /** Fascia (category sign band). */
  signY: number;
  signH: number;
  winY: number;
  winH: number;
  sillH: number;
  /** Where shoppers' feet stand. */
  feetY: number;
  /** Top of the floor surface in front of the windows. */
  floorY: number;
}

export const FLOORS: [FloorGeom, FloorGeom] = [
  { signY: 166, signH: 28, winY: 202, winH: 128, sillH: 22, feetY: 384, floorY: 354 },
  { signY: 412, signH: 30, winY: 450, winH: 140, sillH: 22, feetY: 664, floorY: 612 },
];

export const UPPER: Category[] = ['electronics', 'home', 'fashion'];
export const LOWER: Category[] = ['toys', 'beauty', 'grocery'];

export interface WindowSlot<T> {
  item: T | null;
  x: number;
  y: number;
  w: number;
  h: number;
  floor: 0 | 1;
  category: Category;
  index: number;
}

export interface BlockGeom<T> {
  category: Category;
  floor: 0 | 1;
  x: number;
  w: number;
  windows: WindowSlot<T>[];
}

export interface ArcadeLayout<T> {
  width: number;
  /** Left edge of the content (the scene is centred when wider blocks need less than the minimum width). */
  x0: number;
  blocks: BlockGeom<T>[];
  windows: WindowSlot<T>[];
}

const blockW = (n: number) => PAD + Math.max(1, n) * (WIN_W + PAD);

/**
 * Lay the deals out: categories in fixed places (electronics, home, fashion upstairs; toys, beauty, grocery at street
 * level), windows in the given order inside each block. A category with no deals keeps one empty window ("to let").
 */
export function layoutArcade<T>(items: T[], categoryOf: (t: T) => Category): ArcadeLayout<T> {
  const by = new Map<Category, T[]>(CATEGORIES.map((c) => [c, []]));
  for (const it of items) by.get(categoryOf(it))?.push(it);
  const floorWidth = (cats: Category[]) => cats.reduce((s, c) => s + blockW(by.get(c)!.length), 0) + COL * (cats.length - 1);
  const content = Math.max(floorWidth(UPPER), floorWidth(LOWER));
  const width = Math.max(SCENE_MIN_W, content + 2 * 30);
  const blocks: BlockGeom<T>[] = [];
  ([UPPER, LOWER] as const).forEach((cats, f) => {
    const floor = f as 0 | 1;
    const g = FLOORS[floor];
    let x = (width - floorWidth(cats)) / 2;
    for (const category of cats) {
      const list = by.get(category)!;
      const w = blockW(list.length);
      const slots = (list.length ? list : [null]).map(
        (item, index): WindowSlot<T> => ({ item, x: x + PAD + index * (WIN_W + PAD), y: g.winY, w: WIN_W, h: g.winH, floor, category, index }),
      );
      blocks.push({ category, floor, x, w, windows: slots });
      x += w + COL;
    }
  });
  return { width, x0: (width - content) / 2, blocks, windows: blocks.flatMap((b) => b.windows) };
}

/** Deterministic 32-bit hash of a string (FNV-1a with a final mix). */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return h >>> 0;
}

/** A deterministic number in [0, 1) for a key. */
export const rand = (key: string) => hash(key) / 4294967296;
