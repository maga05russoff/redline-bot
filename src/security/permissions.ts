import type { ChatInputCommandInteraction } from 'discord.js';
import { env } from '../config.js';

function getBotAdminIds(): string[] {
  return env.BOT_ADMIN_IDS
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isBotOwner(interaction: ChatInputCommandInteraction): boolean {
  return interaction.user.id === env.BOT_OWNER_ID;
}

export function isBotAdmin(interaction: ChatInputCommandInteraction): boolean {
  return getBotAdminIds().includes(interaction.user.id);
}

export function canManageBot(interaction: ChatInputCommandInteraction): boolean {
  return isBotOwner(interaction) || isBotAdmin(interaction);
}
