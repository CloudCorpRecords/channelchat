# BUILD-REPORT — channelchat (original: slack / @modelcontextprotocol/server-slack)

Built 2026-10-26 for the MCP Rebuild 100 program (Tier C).
Local only; nothing pushed or published.

## Identity

- npm: `@reneturcios/channelchat`, bin `channelchat`, version 0.1.0
- Registry name: `io.github.CloudCorpRecords/channelchat`
  (matches package.json `mcpName`, server.json `name`, and the
  Dockerfile `io.modelcontextprotocol.server.name` label)
- server.json description: 77 chars (≤100, counted)
- server.json OCI package entry: no `version` field (version only in
  the tagged identifier `ghcr.io/cloudcorprecords/channelchat:0.1.0`)

## Scope — full documented set, 8 of 8

Same surface as the fixture
`harness/fixtures/slack-tools-original.json` (`_source`: full
documented 8-tool set of @modelcontextprotocol/server-slack; the
audited index `~/workspace/packages-100/mcp-server-index-external.md`
records only its no-creds behaviour — fatal "Please set
SLACK_BOT_TOKEN and SLACK_TEAM_ID environment variables" — so the
schemas are docs-derived):

| Tool | Required | Optional |
| --- | --- | --- |
| `slack_list_channels` | — | `types`, `exclude_archived`, `limit` |
| `slack_post_message` | `channel_id`, `text` | — |
| `slack_reply_to_thread` | `channel_id`, `thread_ts`, `text` | — |
| `slack_add_reaction` | `channel_id`, `timestamp`, `reaction` | — |
| `slack_get_channel_history` | `channel_id` | `limit` |
| `slack_get_thread_replies` | `channel_id`, `thread_ts` | — |
| `slack_get_users` | — | `cursor`, `limit` |
| `slack_get_user_profile` | `user_id` | — |

Registered via the low-level MCP `Server` API with explicit
inputSchema literals; zod validates call arguments.

## Implementation

- Slack Web API: every method is a POST to
  `https://slack.com/api/<method>` with a JSON body and
  `Authorization: Bearer <SLACK_BOT_TOKEN>`.
- Both `SLACK_BOT_TOKEN` and `SLACK_TEAM_ID` are required, matching
  the original; a call with either missing is an error naming the
  missing variable(s) before any request is made. `SLACK_TEAM_ID` is
  sent as `team_id` to the methods that accept it
  (`conversations.list`, `users.list`).
- Caller-facing argument names are mapped to Web API parameter names
  in the core: `channel_id`→`channel`, `thread_ts`→`ts` (replies) /
  `thread_ts` (threaded posts), `reaction`→`name`, `user_id`→`user`.
- Slack returns HTTP 200 with `{ ok: false, error }` for application
  errors; the `error` string is surfaced as the call's error.
  Non-200 HTTP responses and connection failures are also surfaced.
- All HTTP goes through an injectable `FetchFn`.

## Verification (all foreground, verified from disk/output)

- tsc: `npm run build` exit 0; `dist/cli.js` present;
  `node dist/cli.js --version` → `0.1.0`; unknown command prints
  Usage and exits 2
- Tests: 16/16 pass (`npm test`, fake fetch only — URL/method/auth
  header/body shaping for all 8 methods, argument name mapping,
  `ok: false` handling on HTTP 200, HTTP and connection failures,
  missing-credential errors naming `SLACK_BOT_TOKEN` /
  `SLACK_TEAM_ID` with no request made)
- Parity: fixture `harness/fixtures/slack-tools-original.json` vs
  live stdio rebuild via `harness/parity.py` → `parity_pct == 100.0`,
  identical 8/8, output in `parity-out/parity.json` (verdict PASS)
- Missing-env stdio check: with both `SLACK_BOT_TOKEN` and
  `SLACK_TEAM_ID` unset, initialize succeeds and a `tools/call` for
  `slack_post_message` returns `isError` naming both variables
  (verified live over stdio)

## Honest gaps

- No live call to slack.com was made or claimed (no bot token in this
  environment); wire behaviour is proven against fake-fetch fixtures
  only, so upstream response-shape drift is unverified until the
  publish-wave live smoke.
- Channel history uses `conversations.history`, which reflects the
  current Slack API; workspaces whose bot lacks the relevant history
  scopes will surface Slack's own error string.
- Lockfile flag: `package-lock.json` is a copy of the libdocs-remote
  lockfile with identity fields edited (name, bin). **Clean lockfile
  regeneration (no node_modules present) is required before
  publish** — fleet lesson 2026-10-25 / Blocker 3.
- mcpaudit / mcpvet / shipcheck pre-publish gate not run (belongs to
  the publish wave, per SCOREBOARD).
