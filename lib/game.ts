import { CARD_BY_ID, CARDS, cardsMatch, type CatCard } from "./cards";

export type SlotStatus = "hidden" | "visible" | "matched";
export type GameSlot = { index: number; cardId: string | null; status: SlotStatus };
export type GameState = {
  room: string;
  status: "playing" | "complete";
  slots: GameSlot[];
  open: number[];
  lastRevealed: number | null;
  pendingResult: "match" | "miss" | null;
  matches: number;
  moves: number;
  currentPlayer: 1 | 2;
  scores: [number, number];
  updated: number;
};

export type PublicSlot = Omit<GameSlot, "cardId"> & { card: CatCard | null };
export type PublicGame = Omit<GameState, "slots"> & { slots: PublicSlot[] };

const shuffled = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export function createGame(room: string): GameState {
  return {
    room,
    status: "playing",
    slots: Array.from({ length: 20 }, (_, index) => ({ index, cardId: null, status: "hidden" })),
    open: [],
    lastRevealed: null,
    pendingResult: null,
    matches: 0,
    moves: 0,
    currentPlayer: 1,
    scores: [0, 0],
    updated: Date.now(),
  };
}

function activeFixed(state: GameState) {
  return state.slots
    .filter((slot) => slot.status !== "matched" && slot.cardId)
    .map((slot) => slot.cardId as string);
}

function unusedCards(state: GameState) {
  const used = new Set(state.slots.flatMap((slot) => (slot.cardId ? [slot.cardId] : [])));
  return CARDS.filter((card) => !used.has(card.id));
}

function canFillHiddenWithPairs(cards: CatCard[], count: number, memo: Map<string, boolean>): boolean {
  if (count === 0) return true;
  if (count < 0 || cards.length < count) return false;
  const key = `${count}:${cards.map((card) => card.id).join(",")}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;

  for (let i = 0; i < cards.length; i += 1) {
    for (let j = i + 1; j < cards.length; j += 1) {
      if (!cardsMatch(cards[i].id, cards[j].id)) continue;
      const rest = cards.filter((_, index) => index !== i && index !== j);
      if (canFillHiddenWithPairs(rest, count - 2, memo)) {
        memo.set(key, true);
        return true;
      }
    }
  }
  memo.set(key, false);
  return false;
}

export function canComplete(state: GameState): boolean {
  const fixed = activeFixed(state);
  const hiddenCount = state.slots.filter((slot) => slot.status !== "matched" && !slot.cardId).length;
  const available = unusedCards(state);
  const memo = new Map<string, boolean>();

  const solve = (remainingFixed: string[], remainingHidden: number, pool: CatCard[]): boolean => {
    if (remainingFixed.length === 0) return canFillHiddenWithPairs(pool, remainingHidden, memo);
    const key = `f:${remainingFixed.slice().sort().join(",")}|h:${remainingHidden}|p:${pool.map((c) => c.id).join(",")}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const first = remainingFixed[0];

    for (let i = 1; i < remainingFixed.length; i += 1) {
      if (!cardsMatch(first, remainingFixed[i])) continue;
      const rest = remainingFixed.filter((_, index) => index !== 0 && index !== i);
      if (solve(rest, remainingHidden, pool)) {
        memo.set(key, true);
        return true;
      }
    }

    if (remainingHidden > 0) {
      for (let i = 0; i < pool.length; i += 1) {
        if (!cardsMatch(first, pool[i].id)) continue;
        const nextPool = pool.filter((_, index) => index !== i);
        if (solve(remainingFixed.slice(1), remainingHidden - 1, nextPool)) {
          memo.set(key, true);
          return true;
        }
      }
    }

    memo.set(key, false);
    return false;
  };

  return solve(fixed, hiddenCount, available);
}

function stateWithAssignment(state: GameState, index: number, cardId: string, matchedPair = false) {
  const slots = state.slots.map((slot) => ({ ...slot }));
  slots[index].cardId = cardId;
  slots[index].status = "visible";
  if (matchedPair && state.open.length === 1) {
    slots[state.open[0]].status = "matched";
    slots[index].status = "matched";
  }
  return { ...state, slots };
}

function partnerCount(card: CatCard, pool: CatCard[]) {
  return pool.filter((candidate) => candidate.id !== card.id && cardsMatch(card.id, candidate.id)).length;
}

function chooseAssignable(state: GameState, index: number, candidates: CatCard[], matchedPair = false) {
  const pool = unusedCards(state);
  const ordered = shuffled(candidates).sort((a, b) => {
    if (a.avoided !== b.avoided) return Number(a.avoided) - Number(b.avoided);
    return partnerCount(a, pool) - partnerCount(b, pool);
  });
  return ordered.find((card) => canComplete(stateWithAssignment(state, index, card.id, matchedPair))) ?? null;
}

export function revealCard(state: GameState, index: number): GameState {
  if (state.status !== "playing" || state.pendingResult || state.open.length >= 2) return state;
  const target = state.slots[index];
  if (!target || target.status !== "hidden") return state;

  const next: GameState = {
    ...state,
    slots: state.slots.map((slot) => ({ ...slot })),
    open: [...state.open],
    updated: Date.now(),
  };

  if (!target.cardId) {
    const pool = unusedCards(state);
    let chosen: CatCard | null = null;
    if (state.open.length === 0) {
      chosen = chooseAssignable(state, index, pool);
    } else {
      const firstId = state.slots[state.open[0]].cardId as string;
      const activeCount = state.slots.filter((slot) => slot.status !== "matched").length;
      const matching = pool.filter((card) => cardsMatch(firstId, card.id));
      const misses = pool.filter((card) => !cardsMatch(firstId, card.id));
      const forceMatch = activeCount <= 4;
      const wantsMatch = forceMatch || Math.random() < 0.5;
      chosen = wantsMatch
        ? chooseAssignable(state, index, matching, true)
        : chooseAssignable(state, index, misses, false);
      chosen ??= chooseAssignable(state, index, matching, true);
      chosen ??= chooseAssignable(state, index, misses, false);
    }
    if (!chosen) return state;
    next.slots[index].cardId = chosen.id;
  }

  next.slots[index].status = "visible";
  next.open.push(index);
  next.lastRevealed = index;

  if (next.open.length === 2) {
    const [a, b] = next.open.map((slotIndex) => next.slots[slotIndex].cardId as string);
    next.pendingResult = cardsMatch(a, b) ? "match" : "miss";
    next.moves += 1;
  }
  return next;
}

export function resolveTurn(state: GameState): GameState {
  if (!state.pendingResult || state.open.length !== 2) return state;
  const slots = state.slots.map((slot) => ({ ...slot }));
  const currentPlayer = state.currentPlayer ?? 1;
  const scores: [number, number] = [...(state.scores ?? [0, 0])] as [number, number];
  const activeCount = state.slots.filter((slot) => slot.status !== "matched").length;
  const finalPairRescue = state.pendingResult === "miss" && activeCount === 2;
  if (state.pendingResult === "match" || finalPairRescue) {
    state.open.forEach((index) => { slots[index].status = "matched"; });
    scores[currentPlayer - 1] += 1;
  } else {
    state.open.forEach((index) => { slots[index].status = "hidden"; });
  }
  const matches = state.matches + (state.pendingResult === "match" || finalPairRescue ? 1 : 0);
  return {
    ...state,
    slots,
    open: [],
    pendingResult: null,
    matches,
    scores,
    currentPlayer: state.pendingResult === "miss" && !finalPairRescue ? (currentPlayer === 1 ? 2 : 1) : currentPlayer,
    status: matches === 10 ? "complete" : "playing",
    updated: Date.now(),
  };
}

export function publicGame(state: GameState): PublicGame {
  return {
    ...state,
    slots: state.slots.map((slot) => ({
      index: slot.index,
      status: slot.status,
      card: slot.status === "hidden" || !slot.cardId ? null : (CARD_BY_ID.get(slot.cardId) ?? null),
    })),
  };
}
