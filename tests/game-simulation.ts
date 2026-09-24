import assert from "node:assert/strict";
import { AVOIDED_CARD_IDS, cardsMatch } from "../lib/cards";
import { canComplete, createGame, publicGame, resolveTurn, revealCard } from "../lib/game";

let avoidedAssignments = 0;
for (let run = 0; run < 60; run += 1) {
  let game = createGame(`TEST${run}`);
  let guard = 0;
  while (game.status !== "complete" && guard++ < 250) {
    assert.equal(canComplete(game), true, `run ${run}: completion invariant failed`);
    const remaining = game.slots.filter((slot) => slot.status !== "matched");
    const knownPair = remaining.flatMap((a, i) => remaining.slice(i + 1).filter((b) => a.cardId && b.cardId && cardsMatch(a.cardId, b.cardId)).map((b) => [a.index, b.index] as const))[0];
    const first = knownPair?.[0] ?? remaining.find((slot) => slot.cardId)?.index ?? remaining[0].index;
    game = revealCard(game, first);
    const afterFirst = game.slots.filter((slot) => slot.status !== "matched" && slot.index !== first);
    const second = knownPair?.[1] ?? afterFirst.find((slot) => slot.cardId && cardsMatch(game.slots[first].cardId!, slot.cardId))?.index ?? afterFirst.find((slot) => !slot.cardId)?.index ?? afterFirst[0].index;
    game = revealCard(game, second);
    assert.equal(game.open.length, 2);
    game = resolveTurn(game);
  }
  assert.equal(game.status, "complete", `run ${run}: game did not finish`);
  assert.equal(game.matches, 10);
  assert.equal(publicGame(game).slots.every((slot) => slot.status === "matched"), true);
  avoidedAssignments += game.slots.filter((slot) => slot.cardId && AVOIDED_CARD_IDS.has(slot.cardId)).length;
}

console.log(`60 games completed; avoided-card assignments: ${avoidedAssignments}/1200`);

{
  const miss = createGame("TURNTEST");
  miss.slots[0] = { index: 0, cardId: "cute_black", status: "visible" };
  miss.slots[1] = { index: 1, cardId: "large_european", status: "visible" };
  miss.open = [0, 1]; miss.pendingResult = "miss"; miss.moves = 1;
  const switched = resolveTurn(miss);
  assert.equal(switched.currentPlayer, 2, "a miss must switch players");
  assert.deepEqual(switched.scores, [0, 0]);
}

{
  const match = createGame("SCORETEST");
  match.slots[0] = { index: 0, cardId: "cute_black", status: "visible" };
  match.slots[1] = { index: 1, cardId: "beautiful_black", status: "visible" };
  match.open = [0, 1]; match.pendingResult = "match"; match.moves = 1;
  const scored = resolveTurn(match);
  assert.equal(scored.currentPlayer, 1, "a match must keep the turn");
  assert.deepEqual(scored.scores, [1, 0]);
}

{
  const rescue = createGame("RESCUETEST");
  rescue.slots = rescue.slots.map((slot, index) => index < 18 ? { ...slot, cardId: "cute_black", status: "matched" } : slot);
  rescue.slots[18] = { index: 18, cardId: "cute_black", status: "visible" };
  rescue.slots[19] = { index: 19, cardId: "large_european", status: "visible" };
  rescue.open = [18, 19]; rescue.pendingResult = "miss"; rescue.matches = 9;
  const completed = resolveTurn(rescue);
  assert.equal(completed.status, "complete", "the final two cards must be cleared");
  assert.equal(completed.matches, 10);
}

console.log("turn, score, and final-pair rescue tests passed");
