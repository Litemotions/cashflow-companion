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
- Runs entirely in the browser — no account, no server, no backend. Game state is saved to your device's local storage only.

## Running it

It's a single self-contained HTML file with no build step and no dependencies. Open `cashflow-sheet.html` directly in a browser, or serve the folder with any static file server.

## Data & privacy

Nothing is sent to a server. Each player's game state lives only in their own browser's local storage, tied to that browser and device. Clearing site data, using a private/incognito window, or opening the app in a different browser will not carry a game over.

---

CASHFLOW® and Rich Dad® are trademarks of the Rich Dad Company. This is an independent, non-commercial companion tool and is not affiliated with or endorsed by them.
