import type { PluginContext } from "@northgraindata/dsui-plugin-sdk";
import { PluginRequestError } from "@northgraindata/dsui-plugin-sdk";
import { type Config, type Conversation, conversationSchema } from "./model";

export function owner(context: PluginContext<Config>): string {
  const principal = context.access.principal?.();
  if (!principal) throw new PluginRequestError("Sign in to use the agent", 403);
  return principal.id;
}
function database(context: PluginContext<Config>) {
  const db = context.storage.openDatabase("conversations");
  db.exec(
    "CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS conversations_owner ON conversations(owner_id, updated_at);",
  );
  return db;
}
export function save(
  context: PluginContext<Config>,
  conversation: Conversation,
) {
  database(context)
    .query(
      "INSERT INTO conversations VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at",
    )
    .run(
      conversation.id,
      conversation.ownerId,
      JSON.stringify(conversation),
      new Date().toISOString(),
    );
}
export function read(context: PluginContext<Config>, id: string): Conversation {
  const row = database(context)
    .query<{ data: string }, [string, string]>(
      "SELECT data FROM conversations WHERE id=? AND owner_id=?",
    )
    .get(id, owner(context));
  if (!row) throw new PluginRequestError("Conversation not found", 404);
  return conversationSchema.parse(JSON.parse(row.data));
}
export async function history(context: PluginContext<Config>) {
  const rows = database(context)
    .query<{ data: string }, [string]>(
      "SELECT data FROM conversations WHERE owner_id=? ORDER BY updated_at DESC LIMIT 50",
    )
    .all(owner(context));
  const visible: Array<{
    id: string;
    title: string;
    status: Conversation["status"];
  }> = [];
  for (const row of rows) {
    const conversation = conversationSchema.parse(JSON.parse(row.data));
    try {
      for (const id of new Set([
        ...conversation.serviceIds,
        ...conversation.accessedServiceIds,
      ]))
        await context.access.require(id, "inspect");
      visible.push({
        id: conversation.id,
        title: conversation.title,
        status: conversation.status,
      });
    } catch {
      // A revoked service must also hide the conversation's title from history.
    }
  }
  return visible;
}
