# channelchat

channelchat gives an MCP client a working presence in a Slack
workspace: list the channels, post a message, carry on a thread,
drop a reaction, and look back over history or up at the member list.
It implements the full documented server-slack tool set — all eight
tools — against the Slack Web API.

Two environment variables are required, exactly as in the original
server: `SLACK_BOT_TOKEN` (the bot user OAuth token, sent as a Bearer
token) and `SLACK_TEAM_ID` (the workspace id, passed to the methods
that accept one). If either is missing, every call fails with an
error naming the missing variable instead of failing the handshake.

Slack's Web API answers HTTP 200 even when a call fails, with an
`ok: false` body; channelchat surfaces that body's `error` string as
the tool error, so `channel_not_found` and friends reach the caller
verbatim.

## Install

```bash
npx @reneturcios/channelchat slack_list_channels
docker run -i -e SLACK_BOT_TOKEN -e SLACK_TEAM_ID ghcr.io/cloudcorprecords/channelchat
```

## CLI

```bash
channelchat slack_list_channels --limit 20
channelchat slack_post_message --channel-id C0123 --text "deploy finished"
channelchat slack_reply_to_thread --channel-id C0123 --thread-ts 1700000000.000100 --text "looking into it"
channelchat slack_add_reaction --channel-id C0123 --timestamp 1700000000.000100 --reaction thumbsup
channelchat slack_get_user_profile --user-id U0123
channelchat --version
```

Exit codes: `0` success, `1` API error, `2` usage error.

## MCP server

```bash
npx -y @reneturcios/channelchat mcp
```

```json
{
  "mcpServers": {
    "channelchat": {
      "command": "npx",
      "args": ["-y", "@reneturcios/channelchat", "mcp"],
      "env": { "SLACK_BOT_TOKEN": "xoxb-...", "SLACK_TEAM_ID": "T0123" }
    }
  }
}
```

### Tools

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

Tool arguments use the caller-facing names from the documented
surface (`channel_id`, `thread_ts`, `reaction`, `user_id`); the core
maps them onto the Web API's parameter names (`channel`, `ts`,
`name`, `user`) when it builds each request.

## Development

```bash
npm install
npm run build
npm test
npm run dev
```

Tests run entirely on fake-fetch fixtures, including Slack's
HTTP-200-with-`ok: false` error shape; no network is used.

## License

MIT — see `LICENSE`.
