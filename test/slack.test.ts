import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addReaction,
  credentialsFromEnv,
  getChannelHistory,
  getThreadReplies,
  getUserProfile,
  getUsers,
  listChannels,
  postMessage,
  replyToThread,
  requireCredentials,
} from "../src/slack.js";
import type { FetchFn, HttpResponse } from "../src/types.js";

interface Call {
  url?: string;
  init?: { method?: string; headers?: Record<string, string>; body?: string };
}

const CREDS = { token: "xoxb-test-token", teamId: "T0123ABC" };

function resp(body: unknown, opts: Partial<HttpResponse> = {}): HttpResponse {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: () => null },
    text: async () => text,
    json: async () => JSON.parse(text),
    ...opts,
  };
}

function fake(calls: Call[], body: unknown = { ok: true }): FetchFn {
  return async (url, init) => {
    calls.push({ url, init });
    return resp(body);
  };
}

describe("credentials", () => {
  it("credentialsFromEnv reads both variables", () => {
    assert.deepEqual(
      credentialsFromEnv({ SLACK_BOT_TOKEN: "tok", SLACK_TEAM_ID: "T1" }),
      { token: "tok", teamId: "T1" },
    );
    assert.deepEqual(credentialsFromEnv({}), { token: undefined, teamId: undefined });
  });
  it("requireCredentials names both variables when both are missing", () => {
    assert.throws(() => requireCredentials({}), /SLACK_BOT_TOKEN/);
    assert.throws(() => requireCredentials({}), /SLACK_TEAM_ID/);
  });
  it("requireCredentials names only the missing variable", () => {
    assert.throws(() => requireCredentials({ token: "tok" }), /SLACK_TEAM_ID/);
    assert.throws(() => requireCredentials({ teamId: "T1" }), /SLACK_BOT_TOKEN/);
    try {
      requireCredentials({ token: "tok" });
      assert.fail("should have thrown");
    } catch (err) {
      assert.ok(!(err as Error).message.includes("SLACK_BOT_TOKEN,"));
    }
  });
  it("a missing credential fails before any request is made", async () => {
    const calls: Call[] = [];
    await assert.rejects(
      () => postMessage(fake(calls), { token: "tok" }, { channel_id: "C1", text: "hi" }),
      /SLACK_TEAM_ID/,
    );
    assert.equal(calls.length, 0);
  });
});

describe("method calls", () => {
  it("slack_list_channels POSTs conversations.list with team_id and the Bearer header", async () => {
    const calls: Call[] = [];
    const out = await listChannels(fake(calls, { ok: true, channels: [{ id: "C1" }] }), CREDS, {
      types: "public_channel",
      exclude_archived: true,
      limit: 10,
    });
    assert.deepEqual(out, { ok: true, channels: [{ id: "C1" }] });
    assert.equal(calls[0].url, "https://slack.com/api/conversations.list");
    assert.equal(calls[0].init?.method, "POST");
    assert.equal(calls[0].init?.headers?.Authorization, "Bearer xoxb-test-token");
    assert.deepEqual(JSON.parse(calls[0].init?.body ?? "{}"), {
      types: "public_channel",
      exclude_archived: true,
      limit: 10,
      team_id: "T0123ABC",
    });
  });
  it("slack_post_message maps channel_id to channel in chat.postMessage", async () => {
    const calls: Call[] = [];
    await postMessage(fake(calls, { ok: true, ts: "1.2" }), CREDS, { channel_id: "C1", text: "hello" });
    assert.equal(calls[0].url, "https://slack.com/api/chat.postMessage");
    assert.deepEqual(JSON.parse(calls[0].init?.body ?? "{}"), { channel: "C1", text: "hello" });
  });
  it("slack_reply_to_thread posts with thread_ts", async () => {
    const calls: Call[] = [];
    await replyToThread(fake(calls), CREDS, { channel_id: "C1", thread_ts: "1700.1", text: "reply" });
    assert.equal(calls[0].url, "https://slack.com/api/chat.postMessage");
    assert.deepEqual(JSON.parse(calls[0].init?.body ?? "{}"), {
      channel: "C1",
      thread_ts: "1700.1",
      text: "reply",
    });
  });
  it("slack_add_reaction maps reaction to name in reactions.add", async () => {
    const calls: Call[] = [];
    await addReaction(fake(calls), CREDS, { channel_id: "C1", timestamp: "1700.1", reaction: "thumbsup" });
    assert.equal(calls[0].url, "https://slack.com/api/reactions.add");
    assert.deepEqual(JSON.parse(calls[0].init?.body ?? "{}"), {
      channel: "C1",
      timestamp: "1700.1",
      name: "thumbsup",
    });
  });
  it("slack_get_channel_history calls conversations.history and omits an unset limit", async () => {
    const calls: Call[] = [];
    await getChannelHistory(fake(calls, { ok: true, messages: [] }), CREDS, { channel_id: "C1" });
    assert.equal(calls[0].url, "https://slack.com/api/conversations.history");
    assert.deepEqual(JSON.parse(calls[0].init?.body ?? "{}"), { channel: "C1" });
  });
  it("slack_get_thread_replies maps thread_ts to ts in conversations.replies", async () => {
    const calls: Call[] = [];
    await getThreadReplies(fake(calls, { ok: true, messages: [] }), CREDS, { channel_id: "C1", thread_ts: "1700.1" });
    assert.equal(calls[0].url, "https://slack.com/api/conversations.replies");
    assert.deepEqual(JSON.parse(calls[0].init?.body ?? "{}"), { channel: "C1", ts: "1700.1" });
  });
  it("slack_get_users calls users.list with cursor, limit and team_id", async () => {
    const calls: Call[] = [];
    await getUsers(fake(calls, { ok: true, members: [] }), CREDS, { cursor: "abc", limit: 50 });
    assert.equal(calls[0].url, "https://slack.com/api/users.list");
    assert.deepEqual(JSON.parse(calls[0].init?.body ?? "{}"), {
      cursor: "abc",
      limit: 50,
      team_id: "T0123ABC",
    });
  });
  it("slack_get_user_profile maps user_id to user in users.info", async () => {
    const calls: Call[] = [];
    await getUserProfile(fake(calls, { ok: true, user: { id: "U1" } }), CREDS, { user_id: "U1" });
    assert.equal(calls[0].url, "https://slack.com/api/users.info");
    assert.deepEqual(JSON.parse(calls[0].init?.body ?? "{}"), { user: "U1" });
  });
});

describe("Slack error handling", () => {
  it("surfaces the ok:false error string from an HTTP 200 body", async () => {
    const failing = fake([], { ok: false, error: "channel_not_found" });
    await assert.rejects(
      () => postMessage(failing, CREDS, { channel_id: "Cnope", text: "hi" }),
      /Slack API error: channel_not_found/,
    );
  });
  it("surfaces invalid_auth the same way", async () => {
    const failing = fake([], { ok: false, error: "invalid_auth" });
    await assert.rejects(() => getUsers(failing, CREDS, {}), /invalid_auth/);
  });
  it("surfaces HTTP failures with their status", async () => {
    const failing: FetchFn = async () =>
      resp("server error", { ok: false, status: 500, statusText: "Internal Server Error" });
    await assert.rejects(() => getUsers(failing, CREDS, {}), /HTTP 500/);
  });
  it("surfaces connection failures", async () => {
    const failing: FetchFn = async () => { throw new Error("fetch failed"); };
    await assert.rejects(() => getUsers(failing, CREDS, {}), /Slack API request failed: fetch failed/);
  });
});
