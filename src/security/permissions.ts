import { PermissionFlagsBits, type ChatInputCommandInteraction } from 'discord.js';
import { env } from '../config.js';

export function isBotOwner(interaction: ChatInputCommandInteraction): boolean {
  return interaction.user.id === env.BOT_OWNER_ID;
}

export function isDiscordAdministrator(interaction: ChatInputCommandInteraction): boolean {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
}

export function canManageBot(interaction: ChatInputCommandInteraction): boolean {
  return isBotOwner(interaction) || isDiscordAdministrator(interaction);
}
