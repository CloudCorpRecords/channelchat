# Changelog

## 0.1.0 (2026-10-26)

- Initial release.
- MCP server (`channelchat mcp`, stdio) with the full documented
  server-slack tool set of eight: `slack_list_channels`,
  `slack_post_message`, `slack_reply_to_thread`, `slack_add_reaction`,
  `slack_get_channel_history`, `slack_get_thread_replies`,
  `slack_get_users`, `slack_get_user_profile`.
- CLI with one subcommand per tool, using the same `--flag` argument
  names as the tool parameters.
- Implementation POSTs JSON to `https://slack.com/api/<method>` with
  the token from `SLACK_BOT_TOKEN` sent as a Bearer token. Both
  `SLACK_BOT_TOKEN` and `SLACK_TEAM_ID` are required, matching the
  original server; a missing variable is an error naming it.
- Slack's HTTP 200 `{ ok: false, error }` responses are surfaced as
  errors carrying the Slack error string.
- All HTTP goes through an injectable fetch function, so tests run on
  fixtures with no network access.
