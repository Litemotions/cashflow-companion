/**
 * CASHFLOW Companion — multiplayer API on Cloudflare Workers + D1.
 *
 *   POST   /api/games                    { host_name }              -> { id, code }
 *   GET    /api/games/:code                                         -> { id, code, status }
 *   GET    /api/games/:code/players                                 -> [ player, ... ]
 *   POST   /api/games/:code/players      { client_id, name, ...stats } -> { player, secret }
 *   PATCH  /api/players/:id              { ...stats }   (Bearer secret)
 *   DELETE /api/players/:id                             (Bearer secret)
 *
 * Joining returns a per-player secret. Only a request carrying that secret
 * can update or remove the player, so one phone can't overwrite another's row.
 * Rosters are public to anyone with the game code, same as before.
 */

const MAX_PLAYERS = 12;
const STALE_DAYS = 7;

const STAT_FIELDS = {
  name: "text",
  profession: "text",
  cash: "num",
  passive_income: "num",
  total_expenses: "num",
  progress_pct: "num",
  track: "track",
  out_of_rat_race: "bool",
  won: "bool",
  ft_gain: "num",
  last_action: "text",
};

const PUBLIC_COLUMNS =
  "id, game_id, code, name, profession, cash, passive_income, total_expenses, " +
  "progress_pct, track, out_of_rat_race, won, ft_gain, last_action, updated_at";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
const fail = (status, error) => json({ error }, status);

function now() {
  return new Date().toISOString();
}
function normCode(c) {
  return String(c || "").trim().toUpperCase().slice(0, 20);
}
function cleanText(v, max = 80) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
}
function cleanNum(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-1e12, Math.min(1e12, Math.round(n)));
}

/** Pick and sanitise the stat fields present in a request body. */
function pickStats(body) {
  const out = {};
  for (const [key, kind] of Object.entries(STAT_FIELDS)) {
    if (!(key in body)) continue;
    const v = body[key];
    if (kind === "text") out[key] = cleanText(v, key === "last_action" ? 120 : 60);
    else if (kind === "num") out[key] = cleanNum(v);
    else if (kind === "bool") out[key] = v ? 1 : 0;
    else if (kind === "track") out[key] = v === "fast" ? "fast" : "rat";
  }
  return out;
}

/** D1 stores booleans as 0/1 — hand the browser real booleans back. */
function toPublic(row) {
  return { ...row, out_of_rat_race: !!row.out_of_rat_race, won: !!row.won };
}

function genCode() {
  const n = 1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000);
  return "PLAY-" + n;
}
function genSecret() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]);
}

async function readBody(request) {
  const text = await request.text();
  if (text.length > 4096) throw new Error("too large");
  if (!text) return {};
  const body = JSON.parse(text);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("bad body");
  return body;
}

function bearer(request) {
  const h = request.headers.get("Authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

/* ---------------- handlers ---------------- */

async function createGame(env, body) {
  const host = cleanText(body.host_name, 60);
  for (let attempt = 0; attempt < 8; attempt++) {
    const id = crypto.randomUUID();
    const code = genCode();
    const res = await env.DB.prepare(
      "INSERT INTO games (id, code, host_name, status, created_at) VALUES (?, ?, ?, 'lobby', ?) ON CONFLICT(code) DO NOTHING"
    ).bind(id, code, host, now()).run();
    if (res.meta.changes === 1) return json({ id, code }, 201);
  }
  return fail(503, "Could not allocate a game code, try again.");
}

async function getGame(env, code) {
  const game = await env.DB.prepare("SELECT id, code, status FROM games WHERE code = ?").bind(code).first();
  return game ? json(game) : fail(404, "No game found with that code.");
}

async function listPlayers(env, code) {
  const { results } = await env.DB.prepare(
    `SELECT ${PUBLIC_COLUMNS} FROM players WHERE code = ? ORDER BY rowid`
  ).bind(code).all();
  return json(results.map(toPublic));
}

async function joinGame(env, code, body) {
  const game = await env.DB.prepare("SELECT id FROM games WHERE code = ?").bind(code).first();
  if (!game) return fail(404, "No game found with that code.");

  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM players WHERE game_id = ?").bind(game.id).first("n");
  if (count >= MAX_PLAYERS) return fail(409, "That game is full.");

  const stats = pickStats(body);
  if (!stats.name) return fail(400, "Enter your name.");

  const id = crypto.randomUUID();
  const secret = genSecret();
  const row = {
    id,
    game_id: game.id,
    code,
    client_id: cleanText(body.client_id, 64) || "unknown",
    secret,
    profession: "",
    ...stats,
    updated_at: now(),
  };
  const cols = Object.keys(row);
  await env.DB.prepare(
    `INSERT INTO players (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`
  ).bind(...cols.map((c) => row[c])).run();

  const player = await env.DB.prepare(`SELECT ${PUBLIC_COLUMNS} FROM players WHERE id = ?`).bind(id).first();
  return json({ player: toPublic(player), secret }, 201);
}

async function updatePlayer(env, id, secret, body) {
  const stats = pickStats(body);
  if (stats.name === "") delete stats.name;
  const cols = Object.keys(stats);
  if (!cols.length) return fail(400, "Nothing to update.");
  const res = await env.DB.prepare(
    `UPDATE players SET ${cols.map((c) => c + " = ?").join(", ")}, updated_at = ? WHERE id = ? AND secret = ?`
  ).bind(...cols.map((c) => stats[c]), now(), id, secret).run();
  return res.meta.changes ? json({ ok: true }) : fail(404, "Player not found.");
}

async function deletePlayer(env, id, secret) {
  const res = await env.DB.prepare("DELETE FROM players WHERE id = ? AND secret = ?").bind(id, secret).run();
  return res.meta.changes ? json({ ok: true }) : fail(404, "Player not found.");
}

/* ---------------- router ---------------- */

async function route(request, env) {
  const url = new URL(request.url);
  const parts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean); // ["api", ...]
  const m = request.method;

  if (m === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (parts[0] !== "api") return fail(404, "Not found.");

  // /api/health
  if (parts.length === 2 && parts[1] === "health" && m === "GET") return json({ ok: true });

  // /api/games
  if (parts[1] === "games") {
    if (parts.length === 2 && m === "POST") return createGame(env, await readBody(request));
    const code = normCode(parts[2]);
    if (!code) return fail(404, "Not found.");
    if (parts.length === 3 && m === "GET") return getGame(env, code);
    if (parts.length === 4 && parts[3] === "players") {
      if (m === "GET") return listPlayers(env, code);
      if (m === "POST") return joinGame(env, code, await readBody(request));
    }
  }

  // /api/players/:id
  if (parts[1] === "players" && parts.length === 3) {
    const secret = bearer(request);
    if (!secret) return fail(401, "Missing player token.");
    if (m === "PATCH") return updatePlayer(env, parts[2], secret, await readBody(request));
    if (m === "DELETE") return deletePlayer(env, parts[2], secret);
  }

  return fail(404, "Not found.");
}

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (e) {
      if (e instanceof SyntaxError || /too large|bad body/.test(e.message)) return fail(400, "Bad request body.");
      console.error(e);
      return fail(500, "Server error.");
    }
  },

  /** Daily: drop games (and their players) with no activity for STALE_DAYS. */
  async scheduled(_event, env) {
    const cutoff = new Date(Date.now() - STALE_DAYS * 864e5).toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `DELETE FROM players WHERE game_id IN (
           SELECT g.id FROM games g WHERE g.created_at < ?1
             AND NOT EXISTS (SELECT 1 FROM players p WHERE p.game_id = g.id AND p.updated_at >= ?1))`
      ).bind(cutoff),
      env.DB.prepare(
        "DELETE FROM games WHERE created_at < ?1 AND NOT EXISTS (SELECT 1 FROM players p WHERE p.game_id = games.id)"
      ).bind(cutoff),
    ]);
  },
};
