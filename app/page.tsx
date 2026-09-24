"use client";

/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CARDS, CATEGORY_ORDER, VALUE_META, type CatCard, type Category } from "../lib/cards";
import { createGame, publicGame, revealCard, resolveTurn, type PublicGame } from "../lib/game";

type ApiState = { game: PublicGame | null; version: number };
type WebMcpDocument = Document & { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } };

const CATEGORY_JA: Record<Category, string> = { opinion: "印象", size: "大きさ", age: "年齢", shape: "形", color: "色", origin: "出身" };
const VALUE_JA: Record<string, string> = { beautiful: "美しい", cute: "かわいい", large: "大きな", small: "小さな", junior: "若い", senior: "年老いた", flat: "平たい", round: "丸い", black: "黒い", european: "ヨーロッパの" };

const EXHIBITION_ROOM = "EXPO23";
const CELEBRATION_EMOJI = ["🐱", "😺", "😸", "😻", "🐈", "🐈‍⬛", "🏆", "🎉", "✨", "🎊", "🐱", "😽", "🏅", "🐾", "😹", "🎉", "🐈", "✨"];

function speak(card: CatCard) {
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(card.sentence);
  utterance.lang = "en-US";
  utterance.rate = 0.82;
  speechSynthesis.speak(utterance);
}

function playCardFlipSound() {
  try {
    const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(620, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(190, context.currentTime + 0.11);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.13);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.14);
    oscillator.onended = () => { void context.close(); };
  } catch { /* audio is optional when the browser blocks it */ }
}

function playMatchSound() {
  try {
    const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.09;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.25);
    });
    window.setTimeout(() => { void context.close(); }, 650);
  } catch { /* audio is optional when the browser blocks it */ }
}

function CardPanel({ card, compact = false }: { card: CatCard | null; compact?: boolean }) {
  const active = new Map(card?.values.map((value) => [VALUE_META[value].category, value]) ?? []);
  const translation = card?.values.slice().sort((a, b) => CATEGORY_ORDER.indexOf(VALUE_META[a].category) - CATEGORY_ORDER.indexOf(VALUE_META[b].category)).map((value) => VALUE_JA[value]).join("") ?? "";
  return <section className={`word-panel ${compact ? "compact" : ""}`} aria-label="カードの英文と属性">
    {!compact && <div className="sentence-row"><div><p className="sentence">{card?.sentence ?? "形容詞の順番"}</p><p className="translation">{card ? `（${translation}猫。）` : "カードをめくると英文が表示されます。"}</p></div>{card && <button className="speak-button" onClick={() => speak(card)} aria-label={`${card.sentence}を音声で聞く`}>🔊<span>音声</span></button>}</div>}
    <div className="attribute-flow">
      {CATEGORY_ORDER.map((category, index) => {
        const value = active.get(category);
        return <div className="attribute-step" key={category}>
          <div className={`attribute ${value ? "active" : ""}`}>
            <span>{category}</span><small>{CATEGORY_JA[category]}</small>
            {value && <strong>{VALUE_META[value].label}<em>{VALUE_JA[value]}</em></strong>}
          </div>
          {index < CATEGORY_ORDER.length - 1 && <b className="order-arrow" aria-hidden="true">→</b>}
        </div>;
      })}
    </div>
  </section>;
}

function Winner({ scores }: { scores: [number, number] }) {
  const headline = scores[0] === scores[1] ? "DRAW（引き分け）" : `PLAYER ${scores[0] > scores[1] ? 1 : 2} WIN!`;
  return <><h2>{headline}</h2><div className="final-scores"><span><b>P1</b><strong>{scores[0]}</strong><small>ペア</small></span><i>—</i><span><b>P2</b><strong>{scores[1]}</strong><small>ペア</small></span></div></>;
}

function GameComplete({ scores, goHome }: { scores: [number, number]; goHome: () => void }) {
  return <div className="celebration" role="dialog" aria-label="ゲーム結果">
    <div className="emoji-rain" aria-hidden="true">{CELEBRATION_EMOJI.map((emoji, index) => <span key={index}>{emoji}</span>)}</div>
    <section className="result-tile"><Winner scores={scores} /><p>20枚すべて取り切りました。</p><button onClick={goHome}>ホームへ戻る</button></section>
  </div>;
}

function Landing({ choose }: { choose: (mode: string) => void }) {
  return <main className="landing">
    <div className="brand-mark">A→Z</div>
    <p className="eyebrow">英語の形容詞を、並べながら覚える</p>
    <h1>Adjective Parade</h1>
    <p className="intro">同じ言葉を持つカードを見つける神経衰弱。猫の絵を手がかりに、英語の形容詞の順番に親しもう。</p>
    <div className="role-buttons"><button className="primary" onClick={() => choose("solo")}>一人で遊ぶ<span>パソコンで20枚のカードに挑戦</span></button><button className="secondary" onClick={() => choose("rules")}>ゲーム説明<span>遊び方と形容詞の順番</span></button><button className="secondary disabled-mode" type="button" disabled aria-disabled="true">二人で遊ぶ<span>停止中</span></button></div>
  </main>;
}

function Rules({ goHome }: { goHome: () => void }) {
  return <main className="rules-screen"><div className="rules-sheet"><button className="rules-back" onClick={goHome}>← ホームへ戻る</button><p className="eyebrow">HOW TO PLAY（遊び方）</p><h1>ゲーム説明</h1>
    <p>20枚の裏向きカードから、2枚をめくります。2枚に同じ形容詞が1つでもあればペア成立。たとえば <strong>junior（若い）・European（ヨーロッパの）</strong> と <strong>small（小さな）・junior（若い）</strong> は、junior（若い）が共通なのでペアです。</p>
    <p>ペアができた2枚は盤面から取り除かれます。違う場合は内容を見てから「続ける」を押すと裏向きに戻ります。10ペア、20枚すべてを取ればクリアです。</p>
    <p>カードの英文は、<strong>opinion（印象）→ size（大きさ）→ age（年齢）→ shape（形）→ color（色）→ origin（出身）</strong> の順で表示します。猫の絵と英文を覚えながら、形容詞の自然な並び方を繰り返し確認できます。</p>
    <p className="rules-note">この説明文は仮案です。応募後に調整できます。</p><button className="rules-play" onClick={() => location.assign("/?mode=solo")}>一人で遊ぶ →</button>
  </div></main>;
}

function SoloGame({ goHome }: { goHome: () => void }) {
  const [game, setGame] = useState(() => createGame("SOLO"));
  const slots = game.slots;
  const open = game.open.map((index) => ({ index, card: publicGame(game).slots[index].card }));
  const reveal = (index: number) => {
    const next = revealCard(game, index);
    if (next === game) return;
    playCardFlipSound();
    if (next.pendingResult === "match") playMatchSound();
    setGame(next);
  };
  const active = new Set(game.open);
  return <main className="solo-screen">
    <header className="solo-header"><button onClick={goHome}>← ホーム</button><strong>Adjective Parade</strong><span>{game.matches} / 10 ペア</span></header>
    <div className="solo-layout">
      <section className="solo-board" aria-label="20枚のカード盤面"><div className="solo-section-title"><h1>カードをめくろう</h1><p>同じ形容詞がある2枚を探そう</p></div>
        <div className="solo-grid">{slots.map((slot) => {
          const card = slot.cardId ? CARDS.find((item) => item.id === slot.cardId) : null;
          const position = active.has(slot.index) ? game.open.indexOf(slot.index) + 1 : 0;
          return <button key={slot.index} className={`game-card status-${slot.status} solo-card ${position ? `selection-${position}` : ""}`} disabled={slot.status !== "hidden" || !!game.pendingResult} onClick={() => reveal(slot.index)} aria-label={`${slot.index + 1}番のカード${position ? `、${position}枚目` : ""}`}><span className="card-back"><i>✦</i><small>{String(slot.index + 1).padStart(2, "0")}</small></span><span className="card-front">{card && <><img src={card.image} alt="" /><em>{card.sentence}</em></>}</span>{position > 0 && <b className="selection-number">{position}</b>}</button>;
        })}</div>
      </section>
      <aside className="solo-detail" aria-label="めくったカードの詳細"><div className="solo-section-title"><h2>めくったカード</h2><p>選んだ順に、英文と形容詞の並びを確認</p></div>
        {[0, 1].map((position) => {
          const item = open[position];
          return <section className={`solo-reveal selection-${position + 1}`} key={position}><h3><span>{position + 1}</span>{position + 1}枚目 {item ? <small>盤面 {String(item.index + 1).padStart(2, "0")}</small> : null}</h3>
            {item?.card ? <div className="solo-reveal-content"><img src={item.card.image} alt={item.card.sentence} /><CardPanel card={item.card} /></div> : <div className="solo-empty">{position === 0 ? "盤面からカードを選んでください" : "2枚目を選ぶと、ここに並びます"}</div>}
          </section>;
        })}
        {game.pendingResult && <button className={`solo-resolve ${game.pendingResult}`} onClick={() => setGame(resolveTurn(game))}><strong>{game.pendingResult === "match" ? "MATCH!（ペア成立）" : "MISMATCH（不一致）"}</strong><span>確認して続ける →</span></button>}
      </aside>
    </div>
    {game.status === "complete" && <div className="celebration" role="dialog" aria-label="ゲーム結果"><div className="emoji-rain" aria-hidden="true">{CELEBRATION_EMOJI.map((emoji, index) => <span key={index}>{emoji}</span>)}</div><section className="result-tile"><h2>10ペア完成！</h2><p>20枚すべて取り切りました。</p><button onClick={() => setGame(createGame("SOLO"))}>もう一度遊ぶ</button><button onClick={goHome}>ホームへ戻る</button></section></div>}
  </main>;
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [room, setRoom] = useState("");
  const [mode, setMode] = useState("");
  const [data, setData] = useState<ApiState>({ game: null, version: 0 });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [cardView, setCardView] = useState(0);
  const [turnSplash, setTurnSplash] = useState<1 | 2 | null>(null);
  const token = useRef("");
  const touchStart = useRef<number | null>(null);
  const announcedTurn = useRef("");
  const boardStarted = useRef(false);

  useEffect(() => {
    const search = new URLSearchParams(location.search);
    const initialRoom = EXHIBITION_ROOM;
    setRoom(initialRoom);
    setMode(search.get("mode") ?? "");
    token.current = localStorage.getItem(`cat-game-token-${initialRoom}`) ?? crypto.randomUUID();
    localStorage.setItem(`cat-game-token-${initialRoom}`, token.current);
    CARDS.forEach((card) => { const image = new Image(); image.src = card.image; });
    setReady(true);
  }, []);

  const load = useCallback(async () => {
    if (!room || (mode !== "board" && mode !== "display")) return;
    try {
      const response = await fetch(`/api/game?room=${encodeURIComponent(room)}`, { cache: "no-store" });
      if (response.ok) setData(await response.json() as ApiState);
    } catch { /* polling retries */ }
  }, [room, mode]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, mode === "display" ? 300 : 500);
    return () => window.clearInterval(timer);
  }, [load, mode]);

  const act = useCallback(async (action: string, index?: number) => {
    if (busy) return;
    if (action === "start") announcedTurn.current = "";
    setBusy(true);
    try {
      const response = await fetch("/api/game", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ room, token: token.current, action, index, version: data.version }) });
      const payload = await response.json() as ApiState & { error?: string };
      if (payload.game) setData({ game: payload.game, version: payload.version });
      if (action === "reveal" && payload.game?.pendingResult === "match") playMatchSound();
      if (!response.ok && response.status !== 409) setNotice(payload.error ?? "通信に失敗しました。");
    } finally { setBusy(false); }
  }, [busy, data.version, room]);

  useEffect(() => {
    if (!ready || mode !== "board" || boardStarted.current) return;
    boardStarted.current = true;
    void act("start");
  }, [act, mode, ready]);

  const choose = (nextMode: string) => {
    const url = new URL(location.href);
    url.searchParams.delete("room");
    url.searchParams.set("mode", nextMode);
    history.replaceState({}, "", url);
    setMode(nextMode);
  };

  const goHome = () => {
    location.assign(location.pathname);
  };

  const openCards = useMemo(() => data.game?.open.map((index) => data.game?.slots[index]?.card).filter((card): card is CatCard => !!card) ?? [], [data.game]);
  const latest = useMemo(() => data.game?.lastRevealed == null ? null : data.game.slots[data.game.lastRevealed]?.card, [data.game]);
  const shownCard = openCards[cardView] ?? null;

  useEffect(() => { if (openCards.length) setCardView(openCards.length - 1); }, [data.game?.lastRevealed, openCards.length]);

  useEffect(() => {
    const game = data.game;
    if (!game || game.status !== "playing" || game.pendingResult || game.open.length) return;
    const turnKey = `${game.moves}-${game.currentPlayer}`;
    if (announcedTurn.current === turnKey) return;
    announcedTurn.current = turnKey;
    setTurnSplash(game.currentPlayer);
    window.setTimeout(() => setTurnSplash(null), 1000);
  }, [data.game]);

  useEffect(() => {
    const context = (document as WebMcpDocument).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({ name: "read_cat_memory_game", title: "ゲーム状況を読む", description: "部屋番号、手番、得点、手数、直近の英文を読みます。状態は変更しません。", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: () => ({ room, mode, status: data.game?.status ?? "waiting", currentPlayer: data.game?.currentPlayer ?? 1, scores: data.game?.scores ?? [0, 0], moves: data.game?.moves ?? 0, latestSentence: latest?.sentence ?? null }) }, { signal: lifecycle.signal })).catch(() => {});
    return () => lifecycle.abort();
  }, [data.game?.currentPlayer, data.game?.moves, data.game?.scores, data.game?.status, latest?.sentence, mode, room]);

  const swipe = (end: number) => {
    if (touchStart.current == null || openCards.length < 2) return;
    const distance = end - touchStart.current;
    if (Math.abs(distance) > 35) setCardView(distance < 0 ? 1 : 0);
    touchStart.current = null;
  };

  if (!ready) return null;
  if (!mode) return <Landing choose={choose} />;
  if (mode === "rules") return <Rules goHome={goHome} />;
  if (mode === "solo") return <SoloGame goHome={goHome} />;

  if (mode === "display") return <main className="display-screen">
    <header className="display-header"><button className="home-button" onClick={goHome}>⌂ ホーム</button><b>PLAYER {data.game?.currentPlayer ?? 1}</b><i className={data.game ? "online" : ""}>{data.game ? "同期中" : "待機中"}</i></header>
    {shownCard ? <>
      <div className="hero-image" onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }} onTouchEnd={(event) => swipe(event.changedTouches[0].clientX)}><img src={shownCard.image} alt={shownCard.sentence} /></div>
      {data.game?.pendingResult && openCards.length === 2 && <div className="card-switcher"><button onClick={() => setCardView(0)} aria-label="1枚目を見る">←</button><span>{cardView + 1} / 2</span><button onClick={() => setCardView(1)} aria-label="2枚目を見る">→</button></div>}
      <CardPanel card={shownCard} />
    </> : <><div className="waiting"><div className="cat-face">🐱</div><h1>カードを待っています</h1><p>盤面の端末で猫をめくってください。</p></div><CardPanel card={null} /></>}
    {data.game?.pendingResult && <button className={`result-bar result-action ${data.game.pendingResult}`} onClick={() => act("resolve")} disabled={busy}><strong>{data.game.pendingResult === "match" ? "MATCH!（ペア成立）" : "MISMATCH（不一致）"}</strong><span>タップして続ける</span></button>}
    {data.game?.status === "complete" && <GameComplete scores={data.game.scores ?? [0, 0]} goHome={goHome} />}
    {turnSplash && <div className={`turn-splash player-${turnSplash}`}><span>PLAYER {turnSplash}</span><strong>プレイヤー{turnSplash}のターン</strong></div>}
  </main>;

  return <main className="board-screen">
    <header className="board-header"><button className="home-button" onClick={goHome}>⌂ ホーム</button><strong>PLAYER {data.game?.currentPlayer ?? 1}（プレイヤー{data.game?.currentPlayer ?? 1}）</strong><span aria-hidden="true" /></header>
    <div className="scorebar"><span><i>P1</i><b>{data.game?.scores?.[0] ?? 0}</b><small>ペア</small></span><span><i>P2</i><b>{data.game?.scores?.[1] ?? 0}</b><small>ペア</small></span></div>
    <CardPanel card={shownCard ?? latest ?? null} compact />
    {!data.game ? <section className="start-card"><div className="big-paw">🐱</div><h2>ゲームを準備しています</h2></section> : <section className="board-grid" aria-label="20枚のカード盤面">{data.game.slots.map((slot) => <button key={slot.index} className={`game-card status-${slot.status}`} disabled={busy || slot.status !== "hidden" || !!data.game?.pendingResult} onClick={() => { playCardFlipSound(); void act("reveal", slot.index); }} aria-label={`${slot.index + 1}番のカード`}><span className="card-back"><i>🐱</i><small>{String(slot.index + 1).padStart(2, "0")}</small></span><span className="card-front">{slot.card && <><img src={slot.card.image} alt="" /><em>{slot.card.sentence}</em></>}</span></button>)}</section>}
    {data.game?.pendingResult && <button className={`board-result result-action ${data.game.pendingResult}`} onClick={() => act("resolve")} disabled={busy}><strong>{data.game.pendingResult === "match" ? "MATCH!（ペア成立）" : "MISMATCH（不一致）"}</strong><span>タップして続ける</span></button>}
    {data.game?.status === "complete" && <GameComplete scores={data.game.scores ?? [0, 0]} goHome={goHome} />}
    {turnSplash && <div className={`turn-splash player-${turnSplash}`}><span>PLAYER {turnSplash}</span><strong>プレイヤー{turnSplash}のターン</strong></div>}
    {notice && <button className="notice" onClick={() => setNotice("")}>{notice}</button>}
  </main>;
}
