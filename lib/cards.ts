export const CATEGORY_ORDER = ["opinion", "size", "age", "shape", "color", "origin"] as const;
export type Category = (typeof CATEGORY_ORDER)[number];

export const VALUE_META: Record<string, { category: Category; label: string }> = {
  beautiful: { category: "opinion", label: "beautiful" },
  cute: { category: "opinion", label: "cute" },
  large: { category: "size", label: "large" },
  small: { category: "size", label: "small" },
  junior: { category: "age", label: "junior" },
  senior: { category: "age", label: "senior" },
  flat: { category: "shape", label: "flat" },
  round: { category: "shape", label: "round" },
  black: { category: "color", label: "black" },
  european: { category: "origin", label: "European" },
};

const FILES = [
  "beautiful_black.jpg", "beautiful_european.jpg", "beautiful_flat.jpg", "beautiful_junior.jpg",
  "beautiful_large.jpg", "beautiful_round.jpg", "beautiful_senior.jpg", "beautiful_small.jpg",
  "cute_black.jpg", "cute_european.jpg", "cute_flat.jpg", "cute_junior.jpg", "cute_large.jpg",
  "cute_round.jpg", "cute_senior.jpg", "cute_small.jpg", "junior_black.jpg", "junior_european.jpg",
  "junior_flat.jpg", "junior_round.png", "large_black.jpg", "large_european.jpg", "large_flat.jpg",
  "large_junior.jpg", "large_round.jpg", "large_senior.jpg", "senior_black.jpg", "senior_european.jpg",
  "senior_flat.jpg", "senior_round.jpg", "small_black.jpg", "small_european.jpg", "small_flat.jpg",
  "small_junior.png", "small_round.jpg", "small_senior.jpg",
] as const;

export const AVOIDED_CARD_IDS = new Set([
  "beautiful_senior", "large_junior", "beautiful_flat", "junior_round",
  "senior_flat", "senior_round", "small_senior",
]);

export type CatCard = {
  id: string;
  values: [string, string];
  image: string;
  sentence: string;
  avoided: boolean;
};

export const CARDS: CatCard[] = FILES.map((file) => {
  const id = file.replace(/\.(jpg|png)$/i, "");
  const values = id.split("_") as [string, string];
  const ordered = [...values].sort(
    (a, b) => CATEGORY_ORDER.indexOf(VALUE_META[a].category) - CATEGORY_ORDER.indexOf(VALUE_META[b].category),
  );
  const words = ordered.map((value) => VALUE_META[value].label);
  return {
    id,
    values,
    image: `/cards/${file}`,
    sentence: `A ${words.join(" ")} cat.`,
    avoided: AVOIDED_CARD_IDS.has(id),
  };
});

export const CARD_BY_ID = new Map(CARDS.map((card) => [card.id, card]));

export function cardsMatch(a: string, b: string) {
  const first = CARD_BY_ID.get(a);
  const second = CARD_BY_ID.get(b);
  return !!first && !!second && first.values.some((value) => second.values.includes(value));
}
