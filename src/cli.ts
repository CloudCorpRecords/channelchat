#!/usr/bin/env node
/**
 * channelchat CLI. One subcommand per MCP tool, plus `mcp`:
 *
 *   channelchat slack_list_channels [--types <types>] [--exclude-archived] [--limit n]
 *   channelchat slack_post_message --channel-id <id> --text <text>
 *   channelchat slack_reply_to_thread --channel-id <id> --thread-ts <ts> --text <text>
 *   channelchat slack_add_reaction --channel-id <id> --timestamp <ts> --reaction <name>
 *   channelchat slack_get_channel_history --channel-id <id> [--limit n]
 *   channelchat slack_get_thread_replies --channel-id <id> --thread-ts <ts>
 *   channelchat slack_get_users [--cursor <cursor>] [--limit n]
 *   channelchat slack_get_user_profile --user-id <id>
 *   channelchat mcp
 *
 * Reads SLACK_BOT_TOKEN and SLACK_TEAM_ID (both required).
 * Exit codes: 0 success, 1 API error, 2 usage error.
 */
import {
  addReaction,
  credentialsFromEnv,
  formatResult,
  getChannelHistory,
  getThreadReplies,
  getUserProfile,
  getUsers,
  listChannels,
  postMessage,
  replyToThread,
  VERSION,
} from "./slack.js";
import type { FetchFn } from "./types.js";

const COMMANDS = [
  "slack_list_channels",
  "slack_post_message",
  "slack_reply_to_thread",
  "slack_add_reaction",
  "slack_get_channel_history",
  "slack_get_thread_replies",
  "slack_get_users",
  "slack_get_user_profile",
];

const NUMERIC_FIELDS = new Set(["limit"]);
const BOOLEAN_FIELDS = new Set(["exclude_archived"]);

function usage(): never {
  console.error(`Usage:
  channelchat slack_list_channels [--types <types>] [--exclude-archived] [--limit n]
  channelchat slack_post_message --channel-id <id> --text <text>
  channelchat slack_reply_to_thread --channel-id <id> --thread-ts <ts> --text <text>
  channelchat slack_add_reaction --channel-id <id> --timestamp <ts> --reaction <name>
  channelchat slack_get_channel_history --channel-id <id> [--limit n]
  channelchat slack_get_thread_replies --channel-id <id> --thread-ts <ts>
  channelchat slack_get_users [--cursor <cursor>] [--limit n]
  channelchat slack_get_user_profile --user-id <id>
  channelchat mcp
  channelchat --version`);
  process.exit(2);
}

/** Parse `--kebab-name value` pairs (and bare boolean flags) into snake_case. */
function parseFlags(args: string[]): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) usage();
    const key = arg.slice(2).replace(/-/g, "_");
    if (BOOLEAN_FIELDS.has(key)) {
      out[key] = true;
      continue;
    }
    const value = args[i + 1];
    if (value === undefined || value.startsWith("--")) usage();
    i++;
    out[key] = NUMERIC_FIELDS.has(key) ? Number(value) : value;
  }
  return out;
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "mcp") {
    await import("./mcp.js");
    return;
  }
  if (!cmd || !COMMANDS.includes(cmd)) usage();
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  const creds = credentialsFromEnv();
  const a = parseFlags(rest) as never;
  try {
    let out: unknown;
    switch (cmd) {
      case "slack_list_channels": out = await listChannels(fetchFn, creds, a); break;
      case "slack_post_message": out = await postMessage(fetchFn, creds, a); break;
      case "slack_reply_to_thread": out = await replyToThread(fetchFn, creds, a); break;
      case "slack_add_reaction": out = await addReaction(fetchFn, creds, a); break;
      case "slack_get_channel_history": out = await getChannelHistory(fetchFn, creds, a); break;
      case "slack_get_thread_replies": out = await getThreadReplies(fetchFn, creds, a); break;
      case "slack_get_users": out = await getUsers(fetchFn, creds, a); break;
      default: out = await getUserProfile(fetchFn, creds, a); break;
    }
    console.log(formatResult(out));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
void main();
