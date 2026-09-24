import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { games } from "../../../db/schema";
import { createGame, publicGame, resolveTurn, revealCard, type GameState } from "../../../lib/game";

export const runtime = "edge";

const cleanRoom = (value: string | null) => (value ?? "").toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 8);
const parseState = (value: string): GameState => {
  const state = JSON.parse(value) as GameState;
  return { ...state, currentPlayer: state.currentPlayer ?? 1, scores: state.scores ?? [0, 0] };
};

export async function GET(request: Request) {
  const room = cleanRoom(new URL(request.url).searchParams.get("room"));
  if (!room) return Response.json({ error: "部屋番号が必要です。" }, { status: 400 });
  const [row] = await getDb().select().from(games).where(eq(games.room, room)).limit(1);
  if (!row) return Response.json({ game: null });
  return Response.json({ game: publicGame(parseState(row.state)), version: row.version });
}

export async function POST(request: Request) {
  const body = await request.json() as { room?: string; token?: string; action?: string; index?: number; version?: number };
  const room = cleanRoom(body.room ?? null);
  const token = body.token?.trim() ?? "";
  if (!room) return Response.json({ error: "部屋番号が必要です。" }, { status: 400 });
  const db = getDb();

  if (body.action === "start") {
    const state = createGame(room);
    await db.insert(games).values({ room, boardToken: token, state: JSON.stringify(state), version: 1, updated: Date.now() })
      .onConflictDoUpdate({ target: games.room, set: { boardToken: token, state: JSON.stringify(state), version: 1, updated: Date.now() } });
    return Response.json({ game: publicGame(state), version: 1 });
  }

  const [row] = await db.select().from(games).where(eq(games.room, room)).limit(1);
  if (!row) return Response.json({ error: "この部屋はまだ始まっていません。" }, { status: 404 });
  if (body.action !== "resolve" && row.boardToken !== token) return Response.json({ error: "この端末には操作権限がありません。" }, { status: 403 });
  if (body.version !== row.version) return Response.json({ game: publicGame(parseState(row.state)), version: row.version }, { status: 409 });

  const current = parseState(row.state);
  let next = current;
  if (body.action === "reveal" && Number.isInteger(body.index)) next = revealCard(current, body.index as number);
  else if (body.action === "resolve") next = resolveTurn(current);
  else return Response.json({ error: "不明な操作です。" }, { status: 400 });

  if (next === current) return Response.json({ game: publicGame(current), version: row.version });
  const version = row.version + 1;
  const result = await db.update(games).set({ state: JSON.stringify(next), version, updated: Date.now() })
    .where(and(eq(games.room, room), eq(games.version, row.version))).returning({ room: games.room });
  if (!result.length) return Response.json({ error: "同時操作を検出しました。もう一度お試しください。" }, { status: 409 });
  return Response.json({ game: publicGame(next), version });
}
