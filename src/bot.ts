import { Bot, InlineKeyboard, type Context } from "grammy";
import { getConfig, type AppConfig } from "./config";
import {
  claimJobForApproval,
  createJob,
  getJobById,
  rejectJob,
  resetJobToPending,
  setJobChannelMessageId,
} from "./services/jobs";
import type { Env, Job } from "./type";

const MAX_PREVIEW_LENGTH = 3500;
const MAX_CHANNEL_TEXT_LENGTH = 3800;

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

    const [, action, jobIdText] = ctx.match as RegExpMatchArray;
    const jobId = Number(jobIdText);

    try {
      await handleJobDecision(bot, env, config, ctx, action, jobId);
    } catch (error) {
      console.error(`Failed to process job #${jobId} (${action}):`, error);
      await answerCallbackSafely(ctx, "Something went wrong. Please try again.", true);
    }
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

async function handleJobDecision(
  bot: Bot,
  env: Env,
  config: AppConfig,
  ctx: Context,
  action: string,
  jobId: number
): Promise<void> {
  const job = await getJobById(env.jobs_db, jobId);
  if (!job) {
    await ctx.answerCallbackQuery({
      text: `Job #${jobId} could not be found.`,
      show_alert: true,
    });
    return;
  }

  if (job.status !== "pending") {
    await removeReviewButtons(ctx);
    await ctx.answerCallbackQuery({
      text: `Job #${job.id} was already ${job.status}.`,
      show_alert: true,
    });
    return;
  }

  if (action === "reject") {
    const rejected = await rejectJob(env.jobs_db, job.id);
    if (!rejected) {
      await removeReviewButtons(ctx);
      await ctx.answerCallbackQuery({
        text: `Job #${job.id} was already processed.`,
        show_alert: true,
      });
      return;
    }

    await removeReviewButtons(ctx);
    await notifySender(bot, job, "rejected", config.brandName);
    await answerCallbackSafely(ctx, `Job #${job.id} rejected.`);
    await replySafely(ctx, `❌ Job #${job.id} was rejected. The sender has been notified.`);
    return;
  }

  // Claim the job first so two quick clicks cannot publish it twice.
  const claimed = await claimJobForApproval(env.jobs_db, job.id);
  if (!claimed) {
    await removeReviewButtons(ctx);
    await ctx.answerCallbackQuery({
      text: `Job #${job.id} was already processed.`,
      show_alert: true,
    });
    return;
  }

  let channelMessageId: number;
  try {
    const channelMessage = await bot.api.sendMessage(
      config.channelId,
      buildChannelPost(job, config.brandName),
      { parse_mode: "HTML" }
    );
    channelMessageId = channelMessage.message_id;
  } catch (error) {
    console.error(`Failed to publish job #${job.id} to channel:`, error);

    try {
      await resetJobToPending(env.jobs_db, job.id);
    } catch (resetError) {
      console.error(`Failed to reset job #${job.id} to pending:`, resetError);
    }

    await ctx.answerCallbackQuery({
      text: "Could not publish to the channel. Check that the bot is an admin in the channel and CHANNEL_ID is correct, then try again.",
      show_alert: true,
    });
    return;
  }

  try {
    await setJobChannelMessageId(env.jobs_db, job.id, channelMessageId);
  } catch (error) {
    console.error(`Job #${job.id} was published but its channel message ID was not saved:`, error);
  }

  await removeReviewButtons(ctx);
  await notifySender(bot, job, "approved", config.brandName);
  await answerCallbackSafely(ctx, `Job #${job.id} approved and published.`);
  await replySafely(ctx, `✅ Job #${job.id} was published to the channel. The sender has been notified.`);
}

async function answerCallbackSafely(
  ctx: Context,
  text: string,
  showAlert = false
): Promise<void> {
  try {
    await ctx.answerCallbackQuery({ text, show_alert: showAlert });
  } catch (error) {
    console.error("Failed to answer callback query:", error);
  }
}

async function replySafely(ctx: Context, text: string): Promise<void> {
  try {
    await ctx.reply(text);
  } catch (error) {
    console.error("Failed to send admin confirmation:", error);
  }
}

async function removeReviewButtons(ctx: Context): Promise<void> {
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  } catch (error) {
    console.error("Failed to remove review buttons:", error);
  }
}

async function notifySender(
  bot: Bot,
  job: Job,
  decision: "approved" | "rejected",
  brandName: string
): Promise<void> {
  const message =
    decision === "approved"
      ? `✅ Good news! Your job submission #${job.id} has been approved and published on the ${brandName} channel.`
      : `❌ Your job submission #${job.id} was reviewed but could not be approved for publishing. Please check the requirements and try again.`;

  try {
    await bot.api.sendMessage(job.employer_chat_id, message);
  } catch (error) {
    console.error(`Failed to notify the sender of job #${job.id}:`, error);
  }
}

function buildChannelPost(job: Job, brandName: string): string {
  const description = job.formatted_en?.trim() || job.raw_text.trim();
  const body = truncateHtml(escapeHtml(description), MAX_CHANNEL_TEXT_LENGTH);

  return [
    "🚀 <b>New Job Opportunity</b>",
    "",
    body,
    "",
    `📢 <b>${escapeHtml(brandName)}</b>`,
  ].join("\n");
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
