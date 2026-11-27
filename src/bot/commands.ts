import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionFlagsBits, type ChatInputCommandInteraction, type ButtonInteraction,
  type GuildMember, type TextChannel,
} from 'discord.js';
import { prisma } from '../database/prisma.js';

const admin = PermissionFlagsBits.Administrator;
const mod = PermissionFlagsBits.ModerateMembers;
const kick = PermissionFlagsBits.KickMembers;
const ban = PermissionFlagsBits.BanMembers;

export const commandDefinitions = [
  new SlashCommandBuilder().setName('ping').setDescription('Проверить доступность RedLine Bot'),
  new SlashCommandBuilder().setName('panel').setDescription('Показать панель управления ботом'),
  new SlashCommandBuilder().setName('warn').setDescription('Выдать предупреждение участнику')
    .addUserOption(o => o.setName('user').setDescription('Кому выдать предупреждение').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Причина').setRequired(true).setMaxLength(500)),
  new SlashCommandBuilder().setName('warnings').setDescription('Посмотреть предупреждения участника')
    .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true)),
  new SlashCommandBuilder().setName('kick').setDescription('Исключить участника с сервера')
    .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Причина').setRequired(true).setMaxLength(500)),
  new SlashCommandBuilder().setName('ban').setDescription('Заблокировать участника на сервере')
    .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Причина').setRequired(true).setMaxLength(500)),
  new SlashCommandBuilder().setName('timeout').setDescription('Выдать временное ограничение общения')
    .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('Длительность от 1 до 40320 минут').setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(o => o.setName('reason').setDescription('Причина').setRequired(true).setMaxLength(500)),
  new SlashCommandBuilder().setName('untimeout').setDescription('Снять ограничение общения')
    .addUserOption(o => o.setName('user').setDescription('Участник').setRequired(true)),
  new SlashCommandBuilder().setName('ticket').setDescription('Управление тикетами')
    .addSubcommand(s => s.setName('panel').setDescription('Опубликовать панель создания тикетов'))
    .addSubcommand(s => s.setName('close').setDescription('Закрыть текущий тикет')),
  new SlashCommandBuilder().setName('botconfig').setDescription('Настройки RedLine Bot')
    .addSubcommand(s => s.setName('logs').setDescription('Установить канал журналов')
      .addChannelOption(o => o.setName('channel').setDescription('Текстовый канал').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(s => s.setName('ticket-category').setDescription('Установить категорию тикетов')
      .addChannelOption(o => o.setName('category').setDescription('Категория каналов').addChannelTypes(ChannelType.GuildCategory).setRequired(true)))
    .addSubcommand(s => s.setName('support-role').setDescription('Установить роль поддержки')
      .addRoleOption(o => o.setName('role').setDescription('Роль сотрудников поддержки').setRequired(true))),
];

function guildId(interaction: ChatInputCommandInteraction | ButtonInteraction): string {
  if (!interaction.guildId) throw new Error('Команда доступна только на сервере.');
  return interaction.guildId;
}
function has(interaction: ChatInputCommandInteraction, permission: bigint): boolean {
  return interaction.memberPermissions?.has(permission) ?? false;
}
async function requirePermission(interaction: ChatInputCommandInteraction, permission: bigint): Promise<boolean> {
  if (has(interaction, permission)) return true;
  await interaction.reply({ content: 'У вас недостаточно прав для этой команды.', ephemeral: true });
  return false;
}
async function recordCase(interaction: ChatInputCommandInteraction, type: 'WARN'|'KICK'|'BAN'|'TIMEOUT'|'UNTIMEOUT', targetId: string, reason: string, durationMs?: number) {
  const gid = guildId(interaction);
  const latest = await prisma.modCase.findFirst({ where: { guildId: gid }, orderBy: { caseNumber: 'desc' }, select: { caseNumber: true } });
  const entry = await prisma.modCase.create({ data: {
    guildId: gid, caseNumber: (latest?.caseNumber ?? 0) + 1, type,
    moderatorId: interaction.user.id, targetId, reason, durationMs,
  }});
  const config = await prisma.guildConfig.findUnique({ where: { guildId: gid } });
  if (config?.logChannelId && interaction.guild) {
    const channel = await interaction.guild.channels.fetch(config.logChannelId).catch(() => null);
    if (channel?.isTextBased() && 'send' in channel) {
      await channel.send({ embeds: [new EmbedBuilder().setColor(0xdc2626).setTitle(`Модерация • #${entry.caseNumber}`)
        .addFields(
          { name: 'Действие', value: type, inline: true },
          { name: 'Участник', value: `<@${targetId}> (${targetId})`, inline: true },
          { name: 'Модератор', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Причина', value: reason },
        ).setTimestamp()] });
    }
  }
  return entry;
}
async function getTarget(interaction: ChatInputCommandInteraction, userId: string): Promise<GuildMember | null> {
  if (!interaction.guild) return null;
  const target = await interaction.guild.members.fetch(userId).catch(() => null);
  if (!target) return null;
  const actor = await interaction.guild.members.fetch(interaction.user.id);
  if (target.id === interaction.guild.ownerId || target.id === interaction.client.user.id || target.id === actor.id) return null;
  if (actor.id !== interaction.guild.ownerId && actor.roles.highest.comparePositionTo(target.roles.highest) <= 0) return null;
  if (interaction.guild.members.me && interaction.guild.members.me.roles.highest.comparePositionTo(target.roles.highest) <= 0) return null;
  return target;
}

export async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (interaction.commandName === 'ping') {
    await interaction.reply({ content: `Pong! Задержка: ${interaction.client.ws.ping} мс.`, ephemeral: true }); return;
  }
  if (interaction.commandName === 'panel') {
    const embed = new EmbedBuilder().setColor(0xdc2626).setTitle('REDLINE BOT')
      .setDescription('Панель модерации и управления Discord-сервером')
      .addFields(
        { name: 'Модерация', value: '`/warn` `/warnings` `/kick` `/ban` `/timeout` `/untimeout`' },
        { name: 'Поддержка', value: '`/ticket panel` — создать панель тикетов' },
        { name: 'Настройки', value: '`/botconfig` — журналы и тикеты' },
      ).setFooter({ text: 'RedLine Bot • Discord moderation' });
    await interaction.reply({ embeds: [embed], ephemeral: true }); return;
  }
  if (interaction.commandName === 'warn') {
    if (!await requirePermission(interaction, mod)) return;
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    await recordCase(interaction, 'WARN', user.id, reason);
    await interaction.reply({ content: `Предупреждение выдано <@${user.id}>. Причина: ${reason}`, ephemeral: true }); return;
  }
  if (interaction.commandName === 'warnings') {
    if (!await requirePermission(interaction, mod)) return;
    const user = interaction.options.getUser('user', true);
    const cases = await prisma.modCase.findMany({ where: { guildId: guildId(interaction), targetId: user.id, type: 'WARN' }, orderBy: { createdAt: 'desc' }, take: 10 });
    await interaction.reply({ content: cases.length ? cases.map(c => `**#${c.caseNumber}** — ${c.reason} • <t:${Math.floor(c.createdAt.getTime()/1000)}:d>`).join('\n') : 'Предупреждений не найдено.', ephemeral: true }); return;
  }
  if (interaction.commandName === 'kick' || interaction.commandName === 'ban' || interaction.commandName === 'timeout' || interaction.commandName === 'untimeout') {
    const needed = interaction.commandName === 'kick' ? kick : interaction.commandName === 'ban' ? ban : mod;
    if (!await requirePermission(interaction, needed)) return;
    const user = interaction.options.getUser('user', true);
    const target = await getTarget(interaction, user.id);
    if (!target) { await interaction.reply({ content: 'Нельзя выполнить действие: участник недоступен или находится выше бота/вас по иерархии ролей.', ephemeral: true }); return; }
    if (interaction.commandName === 'kick') {
      const reason = interaction.options.getString('reason', true);
      await target.kick(reason); await recordCase(interaction, 'KICK', user.id, reason);
      await interaction.reply({ content: `Участник <@${user.id}> исключён. Причина: ${reason}`, ephemeral: true }); return;
    }
    if (interaction.commandName === 'ban') {
      const reason = interaction.options.getString('reason', true);
      await target.ban({ reason }); await recordCase(interaction, 'BAN', user.id, reason);
      await interaction.reply({ content: `Участник <@${user.id}> заблокирован. Причина: ${reason}`, ephemeral: true }); return;
    }
    if (interaction.commandName === 'timeout') {
      const minutes = interaction.options.getInteger('minutes', true);
      const reason = interaction.options.getString('reason', true);
      await target.timeout(minutes * 60_000, reason); await recordCase(interaction, 'TIMEOUT', user.id, reason, minutes * 60_000);
      await interaction.reply({ content: `Ограничение выдано <@${user.id}> на ${minutes} мин.`, ephemeral: true }); return;
    }
    await target.timeout(null, 'Снято модератором');
    await recordCase(interaction, 'UNTIMEOUT', user.id, 'Ограничение снято модератором');
    await interaction.reply({ content: `Ограничение снято для <@${user.id}>.`, ephemeral: true }); return;
  }
  if (interaction.commandName === 'ticket') {
    const sub = interaction.options.getSubcommand();
    if (sub === 'panel') {
      if (!await requirePermission(interaction, admin)) return;
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('ticket:create').setLabel('Создать обращение').setEmoji('🎫').setStyle(ButtonStyle.Danger));
      await interaction.channel?.send({ embeds: [new EmbedBuilder().setColor(0xdc2626).setTitle('Служба поддержки').setDescription('Нажмите кнопку ниже, чтобы открыть приватный канал обращения.')] , components: [row] });
      await interaction.reply({ content: 'Панель тикетов опубликована.', ephemeral: true }); return;
    }
    const ticket = await prisma.ticket.findUnique({ where: { channelId: interaction.channelId } });
    if (!ticket || ticket.status !== 'OPEN') { await interaction.reply({ content: 'Этот канал не является открытым тикетом.', ephemeral: true }); return; }
    const config = await prisma.guildConfig.findUnique({ where: { guildId: guildId(interaction) } });
    const isSupport = has(interaction, admin) || (!!config?.supportRoleId && interaction.member && 'roles' in interaction.member && interaction.member.roles instanceof Object && (interaction.member as GuildMember).roles.cache.has(config.supportRoleId));
    if (ticket.openerId !== interaction.user.id && !isSupport) { await interaction.reply({ content: 'Закрыть тикет может автор обращения или поддержка.', ephemeral: true }); return; }
    await prisma.ticket.update({ where: { channelId: interaction.channelId }, data: { status: 'CLOSED', closedAt: new Date() } });
    await interaction.reply({ content: 'Тикет закрыт. Канал будет удалён через 5 секунд.' });
    setTimeout(() => interaction.channel?.delete('Тикет закрыт').catch(() => undefined), 5000);
    return;
  }
  if (interaction.commandName === 'botconfig') {
    if (!await requirePermission(interaction, admin)) return;
    const sub = interaction.options.getSubcommand();
    const data = sub === 'logs'
      ? { logChannelId: interaction.options.getChannel('channel', true).id }
      : sub === 'ticket-category'
        ? { ticketCategoryId: interaction.options.getChannel('category', true).id }
        : { supportRoleId: interaction.options.getRole('role', true).id };
    await prisma.guildConfig.upsert({ where: { guildId: guildId(interaction) }, create: { guildId: guildId(interaction), ...data }, update: data });
    await interaction.reply({ content: 'Настройка сохранена.', ephemeral: true }); return;
  }
}

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId !== 'ticket:create') return;
  if (!interaction.guild) { await interaction.reply({ content: 'Тикеты доступны только на сервере.', ephemeral: true }); return; }
  const gid = guildId(interaction);
  const existing = await prisma.ticket.findFirst({ where: { guildId: gid, openerId: interaction.user.id, status: 'OPEN' } });
  if (existing) { await interaction.reply({ content: `У вас уже есть открытый тикет: <#${existing.channelId}>`, ephemeral: true }); return; }
  const config = await prisma.guildConfig.findUnique({ where: { guildId: gid } });
  const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 18) || 'user';
  const channel = await interaction.guild.channels.create({
    name: `ticket-${safeName}`, type: ChannelType.GuildText,
    ...(config?.ticketCategoryId ? { parent: config.ticketCategoryId } : {}),
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
      { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] },
      ...(config?.supportRoleId ? [{ id: config.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
    ],
  });
  await prisma.ticket.create({ data: { guildId: gid, channelId: channel.id, openerId: interaction.user.id } });
  await channel.send({ content: `<@${interaction.user.id}> Добро пожаловать! Опишите ваше обращение. Для закрытия используйте `/ticket close`.` });
  await interaction.reply({ content: `Тикет создан: <#${channel.id}>`, ephemeral: true });
}
