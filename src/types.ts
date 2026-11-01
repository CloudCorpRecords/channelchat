/**
 * channelchat types.
 *
 * Each operation mirrors one tool in the documented server-slack
 * surface: listing channels, posting messages, replying in threads,
 * adding reactions, reading channel history and thread replies, and
 * looking up users. Every operation takes the small set of fields
 * documented for it and returns the raw Slack Web API response object
 * parsed from JSON.
 *
 * HTTP access is described by a minimal response surface so tests can
 * inject a fake fetch and never touch the network.
 */

export interface ListChannelsOptions {
  types?: string;
  exclude_archived?: boolean;
  limit?: number;
}

export interface PostMessageOptions {
  channel_id: string;
  text: string;
}

export interface ReplyToThreadOptions {
  channel_id: string;
  thread_ts: string;
  text: string;
}

export interface AddReactionOptions {
  channel_id: string;
  timestamp: string;
  reaction: string;
}

export interface GetChannelHistoryOptions {
  channel_id: string;
  limit?: number;
}

export interface GetThreadRepliesOptions {
  channel_id: string;
  thread_ts: string;
}

export interface GetUsersOptions {
  cursor?: string;
  limit?: number;
}

export interface GetUserProfileOptions {
  user_id: string;
}

/** Minimal HTTP response surface so tests can inject fixtures. */
export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    redirect?: string;
  },
) => Promise<HttpResponse>;
