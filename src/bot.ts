import { Bot, InlineKeyboard } from "grammy";
import { getConfig } from "./config";
import { createJob } from "./services/jobs";
import type { Env } from "./type";

const MAX_PREVIEW_LENGTH = 3500;

export function createBot(env: Env): Bot {
  const config = getConfig(env);
  const bot = new Bot(env.BOT_TOKEN);

  bot.catch((error) => {
    console.error("Bot error:", error.error);
  });

  bot.command("start", async (ctx) => {
    await ctx.reply(
      `👋 Welcome to ${config.brandName}!\n\n` +
        "Send me a job description as a text message. " +
        "I will forward it to the admin for review before it gets published."
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      `📝 How to submit a job:\n\n` +
        "1. Send the job description here as plain text.\n" +
        "2. Wait for the admin to review it.\n" +
        "3. You will be notified when it is approved or rejected.\n\n" +
        `Questions? Contact the ${config.brandName} team.`
    );
  });

  bot.on("message:text", async (ctx) => {
    const rawText = ctx.message.text.trim();

    // Commands that are not handled above should not be saved as jobs.
    if (rawText.startsWith("/")) {
      await ctx.reply("Unknown command. Send a job description as plain text, or use /help.");
      return;
    }

    if (!rawText) {
      await ctx.reply("Please send the job description as text.");
      return;
    }

    const employerUsername = ctx.from?.username ?? null;

    let job;
    try {
      job = await createJob(env.jobs_db, {
        employerChatId: ctx.chat.id,
        employerUsername,
        rawText,
      });
    } catch (error) {
      await ctx.reply("❌ Sorry, I could not save your job right now. Please try again later.");
      return;
    }

    await notifyAdmin(bot, job.id, rawText, ctx.chat.id, employerUsername, config.adminId);

    await ctx.reply(
      `✅ Job submission #${job.id} received.\n\n` +
        "The admin will review it before it is published. " +
        "You will be notified once a decision is made."
    );
  });

  // Non-text messages cannot be used as a job description.
  bot.on("message", async (ctx) => {
    await ctx.reply("Please send the job description as plain text.");
  });

  bot.callbackQuery(/^job:(approve|reject):(\d+)$/, async (ctx) => {
    if (ctx.from.id !== config.adminId) {
      await ctx.answerCallbackQuery({
        text: "Only the admin can review job submissions.",
        show_alert: true,
      });
      return;
    }

    await ctx.answerCallbackQuery({
      text: "Approve/reject actions are not implemented yet.",
    });
  });

  bot.on("callback_query:data", async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  return bot;
}

async function notifyAdmin(
  bot: Bot,
  jobId: number,
  rawText: string,
  employerChatId: number,
  employerUsername: string | null,
  adminId: number
): Promise<void> {
  const preview = truncateHtml(escapeHtml(rawText), MAX_PREVIEW_LENGTH);

  const employerLabel = employerUsername
    ? `@${escapeHtml(employerUsername)}`
    : "no username";

  const message = [
    `🆕 <b>New job submission #${jobId}</b>`,
    "",
    `<b>From:</b> ${employerLabel}`,
    `<b>Chat ID:</b> <code>${employerChatId}</code>`,
    "",
    "<b>Raw description</b>",
    `<blockquote>${preview}</blockquote>`,
    "",
    "Use the buttons below to moderate this submission.",
  ].join("\n");

  const keyboard = new InlineKeyboard()
    .text("✅ Approve", `job:approve:${jobId}`)
    .text("❌ Reject", `job:reject:${jobId}`);

  try {
    await bot.api.sendMessage(adminId, message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error(`Failed to notify admin (job #${jobId}):`, error);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function truncateHtml(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const clipped = value.slice(0, maxLength).replace(/&[a-zA-Z]*$/, "");
  return `${clipped}\n…(truncated)`;
}
