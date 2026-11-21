# Coup: implementation plan

1. Implement the base game for 3–6 players: two hidden influence cards and two coins, all five roles, challenges, blocks, forced coups at ten coins, elimination and a winner. Use explicit pass responses so everyone has a fair chance to react. The 2-player variant and expansions are out of scope.
2. Put all game decisions and hidden cards on the server. Use random room codes and browser-held player tokens; publish only each player's own cards and public information. Reconnect using the same browser.
3. Build an accessible, responsive table with a lobby, invite link, action/response controls, role reference and public history. Allow a host to start a new game with the same players.
4. Use one SQLite-backed Cloudflare Durable Object per room, with polling for updates and an in-memory Node server for local development. No player account or third-party service is needed. The host deploys to their own Cloudflare account; free-tier quotas apply.
5. Verify game transitions, secrecy and complete multiplayer flows with automated tests, then document running and deploying.

Rules reference: https://northstreetgames.com/images/Rulebooks/Coup-Rules.pdf
Cloudflare pricing: https://developers.cloudflare.com/durable-objects/platform/pricing/
