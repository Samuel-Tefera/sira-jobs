import type { Env } from "./type";

export interface AppConfig {
  botToken: string;
  adminId: number;
  channelId: string;
  brandName: string;
}

export function getConfig(env: Env): AppConfig {
  if (!env.BOT_TOKEN) {
    throw new Error("BOT_TOKEN is not configured");
  }

  const adminId = Number(env.ADMIN_ID);
  if (!Number.isSafeInteger(adminId) || adminId <= 0) {
    throw new Error("ADMIN_ID must be a valid Telegram user ID");
  }

  return {
    botToken: env.BOT_TOKEN,
    adminId,
    channelId: env.CHANNEL_ID,
    brandName: env.BRAND_NAME || "Sira Jobs",
  };
}
