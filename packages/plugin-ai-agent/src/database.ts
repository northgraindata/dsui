import type { PluginContext } from "@northgraindata/dsui-plugin-sdk";
import { PluginRequestError } from "@northgraindata/dsui-plugin-sdk";
import type { DraftAttachment } from "./attachments";
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
  db.exec(
    "CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, data TEXT NOT NULL); CREATE INDEX IF NOT EXISTS attachments_conversation ON attachments(conversation_id);",
  );
  return db;
}
export function save(
  context: PluginContext<Config>,
  conversation: Conversation,
  attachments: readonly DraftAttachment[] = [],
) {
  const db = database(context);
  const write = () => {
    db.query(
      "INSERT INTO conversations VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at",
    ).run(
      conversation.id,
      conversation.ownerId,
      JSON.stringify(conversation),
      new Date().toISOString(),
    );
    for (const attachment of attachments)
      db.query(
        "INSERT INTO attachments (id, conversation_id, data) VALUES (?, ?, ?)",
      ).run(attachment.id, conversation.id, attachment.data);
  };
  if (attachments.length) db.transaction(write)();
  else write();
}

export function readAttachmentData(
  context: PluginContext<Config>,
  conversationId: string,
  attachmentId: string,
) {
  const row = database(context)
    .query<{ data: string }, [string, string, string]>(
      "SELECT attachments.data FROM attachments JOIN conversations ON conversations.id = attachments.conversation_id WHERE attachments.id = ? AND conversations.id = ? AND conversations.owner_id = ?",
    )
    .get(attachmentId, conversationId, owner(context));
  if (!row) throw new PluginRequestError("Attachment not found", 404);
  return row.data;
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
      for (const id of new Set(conversation.accessedServiceIds))
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
