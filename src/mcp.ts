/**
 * channelchat MCP server. Tools (8, the full documented server-slack
 * set): slack_list_channels, slack_post_message, slack_reply_to_thread,
 * slack_add_reaction, slack_get_channel_history,
 * slack_get_thread_replies, slack_get_users, slack_get_user_profile.
 *
 * Why the low-level Server instead of McpServer: the high-level helper
 * converts zod schemas to JSON Schema and injects keys that are not in
 * this tool's public spec ("$schema" and "additionalProperties"), which
 * breaks exact tool-list/schema parity with the spec. This file serves
 * tools/list with the spec's exact input schemas as explicit literals,
 * while zod still validates every tools/call argument set.
 *
 * Credentials are read from SLACK_BOT_TOKEN and SLACK_TEAM_ID at call
 * time; a missing variable returns an honest isError result naming it
 * instead of failing the handshake.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
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

const ListChannelsArgs = z.object({
  types: z.string().optional(),
  exclude_archived: z.boolean().optional(),
  limit: z.number().optional(),
});
const PostMessageArgs = z.object({ channel_id: z.string(), text: z.string() });
const ReplyToThreadArgs = z.object({
  channel_id: z.string(),
  thread_ts: z.string(),
  text: z.string(),
});
const AddReactionArgs = z.object({
  channel_id: z.string(),
  timestamp: z.string(),
  reaction: z.string(),
});
const GetChannelHistoryArgs = z.object({
  channel_id: z.string(),
  limit: z.number().optional(),
});
const GetThreadRepliesArgs = z.object({
  channel_id: z.string(),
  thread_ts: z.string(),
});
const GetUsersArgs = z.object({
  cursor: z.string().optional(),
  limit: z.number().optional(),
});
const GetUserProfileArgs = z.object({ user_id: z.string() });

const TOOLS = [
  {
    name: "slack_list_channels",
    description: "List public or private channels in a Slack workspace.",
    inputSchema: {
      type: "object" as const,
      properties: {
        types: {
          type: "string",
          description: "Comma-separated channel types to list, such as public_channel or private_channel.",
        },
        exclude_archived: {
          type: "boolean",
          description: "Whether to exclude archived channels from the results.",
        },
        limit: { type: "number", description: "Maximum number of channels to return." },
      },
      required: [] as string[],
    },
  },
  {
    name: "slack_post_message",
    description: "Post a new message to a Slack channel.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel_id: { type: "string", description: "ID of the Slack channel to post the message to." },
        text: { type: "string", description: "Text of the message to post." },
      },
      required: ["channel_id", "text"],
    },
  },
  {
    name: "slack_reply_to_thread",
    description: "Reply to a specific message thread in a Slack channel.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel_id: {
          type: "string",
          description: "ID of the Slack channel containing the thread to reply to.",
        },
        thread_ts: {
          type: "string",
          description: "Timestamp of the parent message whose thread the reply belongs to.",
        },
        text: { type: "string", description: "Text of the reply message to post in the thread." },
      },
      required: ["channel_id", "thread_ts", "text"],
    },
  },
  {
    name: "slack_add_reaction",
    description: "Add a reaction emoji to a message in a Slack channel.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel_id: {
          type: "string",
          description: "ID of the Slack channel containing the message to react to.",
        },
        timestamp: {
          type: "string",
          description: "Timestamp of the message to add the reaction to.",
        },
        reaction: {
          type: "string",
          description: "Name of the emoji reaction to add, without colons.",
        },
      },
      required: ["channel_id", "timestamp", "reaction"],
    },
  },
  {
    name: "slack_get_channel_history",
    description: "Get recent messages from a Slack channel.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel_id: {
          type: "string",
          description: "ID of the Slack channel to get message history from.",
        },
        limit: { type: "number", description: "Maximum number of messages to return." },
      },
      required: ["channel_id"],
    },
  },
  {
    name: "slack_get_thread_replies",
    description: "Get all replies in a message thread in a Slack channel.",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel_id: {
          type: "string",
          description: "ID of the Slack channel containing the thread.",
        },
        thread_ts: {
          type: "string",
          description: "Timestamp of the parent message whose thread replies are returned.",
        },
      },
      required: ["channel_id", "thread_ts"],
    },
  },
  {
    name: "slack_get_users",
    description: "Get a list of all users in a Slack workspace.",
    inputSchema: {
      type: "object" as const,
      properties: {
        cursor: {
          type: "string",
          description: "Pagination cursor from a previous response, used to fetch the next page of users.",
        },
        limit: { type: "number", description: "Maximum number of users to return per page." },
      },
      required: [] as string[],
    },
  },
  {
    name: "slack_get_user_profile",
    description: "Get the profile of a specific Slack user.",
    inputSchema: {
      type: "object" as const,
      properties: {
        user_id: { type: "string", description: "ID of the Slack user whose profile is returned." },
      },
      required: ["user_id"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : formatResult(value),
      },
    ],
  };
}
function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "channelchat", version: VERSION },
  { capabilities: { tools: {} } },
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  const creds = credentialsFromEnv();
  try {
    switch (name) {
      case "slack_list_channels":
        return textResult(await listChannels(fetchFn, creds, ListChannelsArgs.parse(args ?? {})));
      case "slack_post_message":
        return textResult(await postMessage(fetchFn, creds, PostMessageArgs.parse(args ?? {})));
      case "slack_reply_to_thread":
        return textResult(await replyToThread(fetchFn, creds, ReplyToThreadArgs.parse(args ?? {})));
      case "slack_add_reaction":
        return textResult(await addReaction(fetchFn, creds, AddReactionArgs.parse(args ?? {})));
      case "slack_get_channel_history":
        return textResult(await getChannelHistory(fetchFn, creds, GetChannelHistoryArgs.parse(args ?? {})));
      case "slack_get_thread_replies":
        return textResult(await getThreadReplies(fetchFn, creds, GetThreadRepliesArgs.parse(args ?? {})));
      case "slack_get_users":
        return textResult(await getUsers(fetchFn, creds, GetUsersArgs.parse(args ?? {})));
      case "slack_get_user_profile":
        return textResult(await getUserProfile(fetchFn, creds, GetUserProfileArgs.parse(args ?? {})));
    }
  } catch (err) {
    return errorResult(err);
  }
  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}
void main();
