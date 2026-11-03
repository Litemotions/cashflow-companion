# CASHFLOW Companion

An unofficial companion app for the CASHFLOW® board game. Each player opens it on their phone, enters their Profession Card once, and every Payday, deal, doodad, baby, and bank loan recalculates automatically — including the Fast Track. The physical board, dice, and cards are still used; this just replaces the pencil math.

## What it does

- Live financial statement: Income, Expenses, Assets, Liabilities, Monthly Cash Flow
- All 12 official profession cards, one-tap to fill — plus a Random button and full manual entry
- One-tap game actions: PAYDAY, Doodad, Baby, Charity, Downsized, Bank loan
- Inline "borrow from the bank" when a payment comes up short, rounded to $1,000 steps automatically
- Buy, sell, and upgrade real estate, businesses, and stocks — with live "left in hand" totals
- Fast Track support once you escape the Rat Race: CASHFLOW Day income, the $50,000 win condition, and buying your Dream
- Undo, and a full ledger of every transaction
- Runs in the browser with no account. Your own sheet is saved to your device's local storage.
- Optional multiplayer: host or join a game code, and everyone's progress shows on a shared TV overview (`overview.html`).

## Running it

It's a single self-contained HTML file with no build step and no dependencies. Open `cashflow-sheet.html` directly in a browser, or serve the folder with any static file server.

## Multiplayer backend (Cloudflare Workers + D1)

The shared lobby/scoreboard is a small API in [`worker/`](worker/): a Cloudflare Worker (`cashflow-companion-api`) backed by a D1 database (`cashflow-companion`). The pages call it at `https://cashflow-companion-api.jibril-60b.workers.dev/api` (`API_BASE` in `index.html` and `overview.html`) and poll every few seconds for updates.

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/games` | Create a game, returns `{ id, code }` |
| `GET` | `/api/games/:code` | Look up a game |
| `GET` | `/api/games/:code/players` | Public roster for the overview |
| `POST` | `/api/games/:code/players` | Join, returns `{ player, secret }` |
| `PATCH` | `/api/players/:id` | Update your stats (`Authorization: Bearer <secret>`) |
| `DELETE` | `/api/players/:id` | Leave the game (`Authorization: Bearer <secret>`) |

A daily cron removes games with no activity for 7 days.

```bash
cd worker
npm install
npm run migrate:local   # create the schema in a local D1
npm run dev             # http://localhost:8787
npm run migrate         # apply migrations to the remote D1
npm run deploy
```

## Data & privacy

Your full financial sheet never leaves your device: it lives in your browser's local storage, tied to that browser and device. Clearing site data, using a private/incognito window, or opening the app in a different browser will not carry a game over.

If you join a multiplayer game, only a summary is shared: your name, profession, cash, passive income, expenses, progress, and last action. Anyone with the game code can see that summary. Leaving the game deletes it, and idle games are deleted automatically after a week.

---

CASHFLOW® and Rich Dad® are trademarks of the Rich Dad Company. This is an independent, non-commercial companion tool and is not affiliated with or endorsed by them.
