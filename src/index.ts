import { webhookCallback } from "grammy";
import { Hono } from "hono";
import { createBot } from "./bot";
import type { Env } from "./type";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) =>
  c.json({
    name: c.env.BRAND_NAME || "Sira Jobs",
    status: "ok",
    message: "Telegram bot is running.",
  })
);

app.get("/health", (c) => c.json({ ok: true }));

app.post("/telegram/webhook", (c) => {
  const bot = createBot(c.env);

  return webhookCallback(bot, "hono", {
    secretToken: c.env.WEBHOOK_SECRET || undefined,
  })(c);
});

app.get("/telegram/set-webhook", async (c) => {
  const bot = createBot(c.env);
  const webhookUrl = new URL("/telegram/webhook", c.req.url).toString();

  await bot.api.setWebhook(webhookUrl, {
    secret_token: c.env.WEBHOOK_SECRET || undefined,
    allowed_updates: ["message", "callback_query"],
  });

  return c.json({ ok: true, webhookUrl });
});

// Returns Telegram's current webhook status.

app.get("/telegram/webhook-info", async (c) => {
  const bot = createBot(c.env);
  const info = await bot.api.getWebhookInfo();

  return c.json({ ok: true, info });
});

// Removes the webhook
app.delete("/telegram/webhook", async (c) => {
  const bot = createBot(c.env);
  await bot.api.deleteWebhook({ drop_pending_updates: false });

  return c.json({ ok: true, deleted: true });
});

app.onError((error, c) => {
  console.error("Worker error:", error);
  return c.json({ ok: false, error: "Internal server error" }, 500);
});

export default app;
