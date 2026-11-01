/**
 * channelchat core: Slack operations against the Slack Web API.
 *
 * Every method is a POST to https://slack.com/api/<method> with a JSON
 * body and the bot token from SLACK_BOT_TOKEN sent as
 * `Authorization: Bearer <token>`. Both SLACK_BOT_TOKEN and
 * SLACK_TEAM_ID are required, matching the original server: a call
 * with either missing is an error before any request is made, and the
 * error names the missing variable(s).
 *
 * Slack answers HTTP 200 even for application errors, with a body of
 * { ok: false, error: "..." }; that error string is surfaced as the
 * call's error. All HTTP goes through an injected FetchFn so request
 * building and response handling are fully testable offline.
 */
import type {
  AddReactionOptions,
  FetchFn,
  GetChannelHistoryOptions,
  GetThreadRepliesOptions,
  GetUserProfileOptions,
  GetUsersOptions,
  ListChannelsOptions,
  PostMessageOptions,
  ReplyToThreadOptions,
} from "./types.js";

export const VERSION = "0.1.0";

export const API_BASE = "https://slack.com/api";

export const TOKEN_ENV = "SLACK_BOT_TOKEN";
export const TEAM_ENV = "SLACK_TEAM_ID";

export interface SlackCredentials {
  token?: string;
  teamId?: string;
}

/** The honest missing-credentials error. Names the variables, never values. */
export function requireCredentials(creds: SlackCredentials): { token: string; teamId: string } {
  const token = typeof creds.token === "string" ? creds.token.trim() : "";
  const teamId = typeof creds.teamId === "string" ? creds.teamId.trim() : "";
  const missing: string[] = [];
  if (!token) missing.push(TOKEN_ENV);
  if (!teamId) missing.push(TEAM_ENV);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}: set SLACK_BOT_TOKEN and SLACK_TEAM_ID and retry`,
    );
  }
  return { token, teamId };
}

export function credentialsFromEnv(
  env: Record<string, string | undefined> = process.env,
): SlackCredentials {
  return { token: env[TOKEN_ENV], teamId: env[TEAM_ENV] };
}

function requireString(value: unknown, field: string): string {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) throw new Error(`${field} must be a non-empty string`);
  return v;
}

function cleanParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

async function callSlack(
  fetchFn: FetchFn,
  creds: SlackCredentials,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const { token } = requireCredentials(creds);
  let response;
  try {
    response = await fetchFn(`${API_BASE}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(cleanParams(params)),
    });
  } catch (err) {
    throw new Error(
      `Slack API request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      `Slack API request failed: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}: response was not valid JSON`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Slack API request failed: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`,
    );
  }
  if (parsed && typeof parsed === "object" && (parsed as { ok?: unknown }).ok === false) {
    const error = (parsed as { error?: unknown }).error;
    throw new Error(
      `Slack API error: ${typeof error === "string" ? error : JSON.stringify(error)}`,
    );
  }
  return parsed;
}

export async function listChannels(
  fetchFn: FetchFn,
  creds: SlackCredentials,
  options: ListChannelsOptions,
): Promise<unknown> {
  const { teamId } = requireCredentials(creds);
  return callSlack(fetchFn, creds, "conversations.list", {
    types: options.types,
    exclude_archived: options.exclude_archived,
    limit: options.limit,
    team_id: teamId,
  });
}

export async function postMessage(
  fetchFn: FetchFn,
  creds: SlackCredentials,
  options: PostMessageOptions,
): Promise<unknown> {
  return callSlack(fetchFn, creds, "chat.postMessage", {
    channel: requireString(options.channel_id, "channel_id"),
    text: requireString(options.text, "text"),
  });
}

export async function replyToThread(
  fetchFn: FetchFn,
  creds: SlackCredentials,
  options: ReplyToThreadOptions,
): Promise<unknown> {
  return callSlack(fetchFn, creds, "chat.postMessage", {
    channel: requireString(options.channel_id, "channel_id"),
    thread_ts: requireString(options.thread_ts, "thread_ts"),
    text: requireString(options.text, "text"),
  });
}

export async function addReaction(
  fetchFn: FetchFn,
  creds: SlackCredentials,
  options: AddReactionOptions,
): Promise<unknown> {
  return callSlack(fetchFn, creds, "reactions.add", {
    channel: requireString(options.channel_id, "channel_id"),
    timestamp: requireString(options.timestamp, "timestamp"),
    name: requireString(options.reaction, "reaction"),
  });
}

export async function getChannelHistory(
  fetchFn: FetchFn,
  creds: SlackCredentials,
  options: GetChannelHistoryOptions,
): Promise<unknown> {
  return callSlack(fetchFn, creds, "conversations.history", {
    channel: requireString(options.channel_id, "channel_id"),
    limit: options.limit,
  });
}

export async function getThreadReplies(
  fetchFn: FetchFn,
  creds: SlackCredentials,
  options: GetThreadRepliesOptions,
): Promise<unknown> {
  return callSlack(fetchFn, creds, "conversations.replies", {
    channel: requireString(options.channel_id, "channel_id"),
    ts: requireString(options.thread_ts, "thread_ts"),
  });
}

export async function getUsers(
  fetchFn: FetchFn,
  creds: SlackCredentials,
  options: GetUsersOptions,
): Promise<unknown> {
  const { teamId } = requireCredentials(creds);
  return callSlack(fetchFn, creds, "users.list", {
    cursor: options.cursor,
    limit: options.limit,
    team_id: teamId,
  });
}

export async function getUserProfile(
  fetchFn: FetchFn,
  creds: SlackCredentials,
  options: GetUserProfileOptions,
): Promise<unknown> {
  return callSlack(fetchFn, creds, "users.info", {
    user: requireString(options.user_id, "user_id"),
  });
}

/** Render an API result as the JSON text block MCP clients display. */
export function formatResult(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
