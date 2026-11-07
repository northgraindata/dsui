// Cloudflare Pages Function. Receives the "Don't see your adapter?" form and
// forwards it to a Discord webhook. The webhook URL is a secret, so it lives in
// the environment (DISCORD_ADAPTER_WEBHOOK_URL) and never reaches the browser.

interface PagesContext {
  request: Request;
  env: { DISCORD_ADAPTER_WEBHOOK_URL?: string };
}

interface AdapterRequest {
  name: string;
  email: string;
  adapter: string;
  message: string;
  page: string;
}

const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_ADAPTER_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_PAGE_LENGTH = 500;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISCORD_EMBED_COLOR = 0x5865f2;

const json = (body: Record<string, string>, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const readText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
};

const parseBody = (value: unknown): AdapterRequest | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  const name = readText(record.name, MAX_NAME_LENGTH);
  const email = readText(record.email, MAX_EMAIL_LENGTH);
  const adapter = readText(record.adapter, MAX_ADAPTER_LENGTH);
  const message = readText(record.message ?? "", MAX_MESSAGE_LENGTH) ?? "";
  const page = readText(record.page ?? "", MAX_PAGE_LENGTH) ?? "";

  if (!name || !email || !adapter || !EMAIL_PATTERN.test(email)) return null;
  return { name, email, adapter, message, page };
};

export const onRequestPost = async ({
  request,
  env,
}: PagesContext): Promise<Response> => {
  const webhookUrl = env.DISCORD_ADAPTER_WEBHOOK_URL;
  if (!webhookUrl) return json({ error: "Not configured" }, 500);

  let body: AdapterRequest | null;
  try {
    body = parseBody(await request.json());
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body) return json({ error: "Invalid request" }, 400);

  const fields = [
    { name: "Name", value: body.name, inline: true },
    { name: "Email", value: body.email, inline: true },
    { name: "Service", value: body.adapter, inline: false },
  ];
  if (body.message)
    fields.push({ name: "Message", value: body.message, inline: false });

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "DSUI adapter requests",
      embeds: [
        {
          title: "New adapter request",
          color: DISCORD_EMBED_COLOR,
          fields,
          footer: { text: body.page || "unknown page" },
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });

  if (!response.ok) return json({ error: "Upstream failed" }, 502);
  return json({ ok: "true" }, 200);
};
