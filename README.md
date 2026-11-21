# Coup for friends

A small independent browser adaptation of the base game of Coup for 2–6 friends. Create a room, share its invite link, and play without accounts. The server enforces turns, challenges, blocks and hidden hands. Players have 25 seconds to challenge a character claim; anyone who does not respond automatically passes. The assassination target can pass, challenge, or block as Contessa in that window; other block decisions remain untimed.

## Play locally

The local game server requires Node.js 20 or newer. For installing the Cloudflare tooling, use a Node version supported by the CLI (currently Node 22.23+, 24.22+ or 26.12+):

```sh
npm test
npm run dev
```

Open http://localhost:3000. To play on the same local network, use your computer's LAN address and port 3000 instead; the built-in local server keeps rooms only in memory, so restarting it clears games. A local address is not accessible to friends over the internet without additional networking.

Create a table, share the link and wait for 2–6 players. The host starts the game. Each player must use their own browser profile or device: a room seat is saved in local storage so a refresh can reconnect it. Clearing browser storage loses that seat. Keep the link private; anyone with it can join an open lobby. Do not share your browser session, because its token controls your seat. All eligible players can respond to a challenge; unanswered challenges automatically pass after 25 seconds. The assassination target can block as Contessa in the challenge window; other blocking decisions are untimed. A disconnected player can reconnect in the same browser; there is no kick option. Use **Exit game** to leave; in an active game this forfeits your influence. **New game** leaves the current table and creates a fresh one. Rooms expire after 10 minutes without a player joining, leaving, or making a game move; merely keeping the page open does not reset the timer.

## How a game is played

1. **Create a table.** Enter a name and select **Create table**. No account is needed.

   ![Create a table screen](docs/screenshots/01-create-table.jpg)

2. **Invite your friends.** Copy the invite link and share it. Once 2–6 players have joined, the host starts the game.

   ![Lobby with three players ready to start](docs/screenshots/02-lobby.jpg)

3. **Take your turn.** Your own influence cards appear face up to you; other players’ cards stay hidden. Choose an action; for assassination, stealing or a coup, select a target in the popup. You can claim a character even when you do not hold it.

   ![A player choosing an action on their turn](docs/screenshots/03-your-turn.jpg)

4. **Respond to claims.** Other players can pass, challenge a character claim, or make an eligible block. The table waits until the required responses are in. When an influence is lost, its owner chooses which card to reveal. The last player with influence wins.

   ![The table waiting for players to respond to a claim](docs/screenshots/04-waiting-for-challenges.jpg)

Screenshots show an example local game; room links and cards change each game.

## Architecture

![Animated architecture: player browsers communicate with a Cloudflare Worker, which routes game actions to a SQLite-backed Durable Object for each room.](docs/architecture.gif)

The animation follows a complete game:

1. **Load:** Each player opens the browser app, which the Worker serves. No login is required.
2. **Create a room:** The host enters a name. The Worker generates a room code and routes it to a Durable Object. The room gives the host a private seat token, stored in the browser.
3. **Join:** Friends use the invite link to join from separate browsers or devices. Each receives their own token and seat.
4. **Start:** The host starts with 2–6 players. The room shuffles and deals two hidden cards each. Players receive two coins, except the starting player in a two-player game, who receives one.
5. **Take a turn:** The current player sends an action and any target. The room checks the token, turn, cost and target. A claimed character may be a bluff.
6. **Respond:** Other eligible players can challenge or pass on a claim. After 25 seconds, unanswered challenges automatically pass.
7. **Resolve a challenge:** A proven character card is shuffled back and replaced; the challenger loses influence. If the claim cannot be proven, the claimant loses influence instead. The loser chooses which card to reveal.
8. **Block:** An eligible player may claim a role to block foreign aid, stealing or assassination. Others may challenge the block; the assassination target can block in the timed response window; other block decisions are untimed.
9. **Apply the action:** The room updates coins or influence. For an exchange, it draws two cards and lets the player select which cards to keep. It stores the updated state in SQLite.
10. **Update views:** Visible browser tabs poll every 2.5 seconds. The room returns the public game state and only the requesting player’s hidden cards.
11. **Finish or leave:** The last player with influence wins. The host can start a rematch; a player who exits during a game forfeits their influence.
12. **Clean up:** A room alarm clears a game after 10 minutes without player activity. Polling alone does not reset that timer.

For local development, the Node server uses the same game rules with rooms held in memory.

To regenerate the diagram, run `python3 scripts/generate_architecture.py` with Pillow installed.

## Cloudflare deployment

The Worker in `src/worker.js` uses a SQLite-backed Durable Object per room; static files live in `public/`. Cloudflare's Workers Free plan includes Durable Objects, within [free usage limits](https://developers.cloudflare.com/durable-objects/platform/pricing/). Polling every 2.5 seconds consumes requests while a tab is active; limits can be reached, and free-tier availability is not guaranteed. Review your Cloudflare account's plan and limits before deploying.

Install the Cloudflare CLI and Vite plugin dependencies, authenticate with your own Cloudflare account, then run the project build and deploy commands:

```sh
npm install
npx cf auth login
npx cf build
npx cf deploy
```

Change the Worker name in `cloudflare.config.ts` if needed. Cloudflare account setup and a workers.dev subdomain may be required. Idle rooms are automatically removed after 10 minutes without player activity. The current implementation is intended for small private games, not a hardened public service: it has no rate limiting, moderation or lobby recovery.

## Rules and scope

The base game uses three each of Duke, Assassin, Captain, Ambassador and Contessa. Character actions and blocks can be bluffed; claims can be challenged. Losing a challenge costs influence; a proven card is shuffled back and replaced. A coup costs seven coins and must be taken at ten or more. The last player with influence wins. See the [rulebook](https://northstreetgames.com/images/Rulebooks/Coup-Rules.pdf). In a two-player game, the starting player receives one coin and the other receives two. The optional two-player character-selection variant and expansions are not included. Original game designed by Rikki Tahta; this is an independent fan implementation and is not affiliated with its publisher.

See [PLAN.md](PLAN.md) for the implementation plan.
