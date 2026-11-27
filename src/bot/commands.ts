import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, type ChatInputCommandInteraction
} from 'discord.js';
import { prisma } from '../database/prisma.js';
import { canManageBot } from '../security/permissions.js';

export const commandDefinitions = [
  new SlashCommandBuilder().setName('ping').setDescription('Проверить доступность RedLine Bot'),
  new SlashCommandBuilder().setName('panel').setDescription('Открыть главную панель RedLine Bot'),
  new SlashCommandBuilder()
    .setName('org')
    .setDescription('Управление организациями')
    .addSubcommand(s => s.setName('list').setDescription('Показать организации')),
];

export async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (interaction.commandName === 'ping') {
    await interaction.reply({ content: `Pong! Задержка: ${interaction.client.ws.ping} мс.`, ephemeral: true });
    return;
  }

  if (interaction.commandName === 'panel') {
    const embed = new EmbedBuilder()
      .setColor(0xDC2626)
      .setTitle('REDLINE BOT')
      .setDescription('Центр управления RedLine RolePlay')
      .addFields(
        { name: 'Организации', value: 'Государственные и коммерческие', inline: true },
        { name: 'Система', value: 'Модули управления и учёта', inline: true },
      )
      .setFooter({ text: 'Игровая система RedLine RolePlay' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('panel:organizations').setLabel('Организации').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('panel:employees').setLabel('Сотрудники').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('panel:documents').setLabel('Документы').setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    return;
  }

  if (interaction.commandName === 'org' && interaction.options.getSubcommand() === 'list') {
    if (!canManageBot(interaction)) {
      await interaction.reply({ content: 'Недостаточно прав для просмотра реестра организаций.', ephemeral: true });
      return;
    }
    const organizations = await prisma.organization.findMany({
      where: { status: 'ACTIVE' }, orderBy: { name: 'asc' }, take: 25
    });
    const description = organizations.length
      ? organizations.map(o => `• **${o.name}** — ${o.type === 'GOVERNMENT' ? 'Государственная' : 'Коммерческая'} (${o.code})`).join('\n')
      : 'Организаций пока нет.';
    await interaction.reply({ content: description, ephemeral: true });
  }
}

export async function handleButton(interaction: import('discord.js').ButtonInteraction): Promise<void> {
  if (!interaction.customId.startsWith('panel:')) return;
  const section = interaction.customId.split(':')[1];
  const labels: Record<string, string> = {
    organizations: 'Раздел организаций будет подключён на следующем этапе.',
    employees: 'Кадровый модуль будет подключён на следующем этапе.',
    documents: 'Документооборот будет подключён на следующем этапе.',
  };
  await interaction.reply({ content: labels[section] ?? 'Раздел пока недоступен.', ephemeral: true });
}
