import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
} from 'discord.js';
import { prisma } from '../database/prisma.js';
import { canManageBot } from '../security/permissions.js';

export const commandDefinitions = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Проверить доступность RedLine Bot'),

  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Открыть главную панель RedLine Bot'),

  new SlashCommandBuilder()
    .setName('org')
    .setDescription('Управление организациями')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('Показать активные организации'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('view')
        .setDescription('Посмотреть карточку организации')
        .addStringOption((option) =>
          option
            .setName('code')
            .setDescription('Уникальный код организации')
            .setRequired(true)
            .setMaxLength(16),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('ranks')
        .setDescription('Настроить и показать должности организации')
        .addStringOption((option) =>
          option
            .setName('code')
            .setDescription('Код организации')
            .setRequired(true)
            .setMaxLength(16),
        )
        .addStringOption((option) =>
          option
            .setName('action')
            .setDescription('Действие')
            .setRequired(true)
            .addChoices(
              { name: 'Создать утверждённую структуру прокуратуры', value: 'setup_prosecutor' },
              { name: 'Показать должности', value: 'list' },
            ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Создать новую организацию')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Полное название организации')
            .setRequired(true)
            .setMaxLength(80),
        )
        .addStringOption((option) =>
          option
            .setName('code')
            .setDescription('Короткий уникальный код: например, МВД или GOV01')
            .setRequired(true)
            .setMinLength(2)
            .setMaxLength(16),
        )
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('Тип организации')
            .setRequired(true)
            .addChoices(
              { name: 'Государственная', value: 'GOVERNMENT' },
              { name: 'Коммерческая', value: 'COMMERCIAL' },
            ),
        )
        .addStringOption((option) =>
          option
            .setName('description')
            .setDescription('Краткое описание (необязательно)')
            .setRequired(false)
            .setMaxLength(500),
        ),
    ),
];

function cleanCode(value: string): string {
  return value.trim().toUpperCase();
}

function isValidCode(value: string): boolean {
  return /^[A-ZА-ЯЁ0-9_-]{2,16}$/.test(value);
}

export async function handleCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (interaction.commandName === 'ping') {
    await interaction.reply({
      content: `Pong! Задержка: ${interaction.client.ws.ping} мс.`,
      ephemeral: true,
    });
    return;
  }

  if (interaction.commandName === 'panel') {
    const embed = new EmbedBuilder()
      .setColor(0xdc2626)
      .setTitle('REDLINE BOT')
      .setDescription('Центр управления RedLine RolePlay')
      .addFields(
        {
          name: 'Организации',
          value: 'Государственные и коммерческие',
          inline: true,
        },
        {
          name: 'Система',
          value: 'Модули управления и учёта',
          inline: true,
        },
      )
      .setFooter({ text: 'Игровая система RedLine RolePlay' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('panel:organizations')
        .setLabel('Организации')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('panel:employees')
        .setLabel('Сотрудники')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('panel:documents')
        .setLabel('Документы')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
    return;
  }

  if (interaction.commandName !== 'org') return;

  // Реестр и изменение организаций доступны только владельцу
  // и ID администраторов, явно внесённым в BOT_ADMIN_IDS.
  if (!canManageBot(interaction)) {
    await interaction.reply({
      content: 'Недостаточно прав. Управление организациями доступно только владельцу и главным администраторам RedLine Bot.',
      ephemeral: true,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'ranks') {
    await manageRanks(interaction);
    return;
  }

  if (subcommand === 'create') {
    await createOrganization(interaction);
    return;
  }

  if (subcommand === 'list') {
    await listOrganizations(interaction);
    return;
  }

  if (subcommand === 'view') {
    await viewOrganization(interaction);
  }
}

async function manageRanks(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const code = cleanCode(interaction.options.getString('code', true));
  const action = interaction.options.getString('action', true);
  const organization = await prisma.organization.findUnique({ where: { code } });

  if (!organization) {
    await interaction.editReply({ content: `Организация с кодом **${code}** не найдена.`, ephemeral: true });
    return;
  }

  if (action === 'setup_prosecutor') {
    if (organization.code !== 'ПРОК') {
      await interaction.editReply({ content: 'Эта готовая структура предназначена только для организации с кодом ПРОК.', ephemeral: true });
      return;
    }

    const ranks = [
      'Стажёр прокуратуры',
      'Помощник прокурора',
      'Прокурор',
      'Старший прокурор',
      'Заместитель начальника управления',
      'Начальник управления',
      'Заместитель генерального прокурора',
      'Первый заместитель генерального прокурора',
      'Генеральный прокурор',
    ];

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < ranks.length; i += 1) {
        await tx.organizationRank.upsert({
          where: { organizationId_level: { organizationId: organization.id, level: i + 1 } },
          update: { name: ranks[i] },
          create: { organizationId: organization.id, name: ranks[i], level: i + 1 },
        });
      }
      await tx.auditLog.create({
        data: {
          actorDiscordId: interaction.user.id,
          action: 'ORG_RANKS_SETUP',
          targetType: 'ORGANIZATION',
          targetId: organization.id,
          outcome: 'SUCCESS',
          details: { ranks },
        },
      });
    });

    await interaction.editReply({
      content: `Структура должностей для **${organization.name}** создана. Всего должностей: **${ranks.length}**.\n\n${ranks.map((name, i) => `**${i + 1}.** ${name}`).join('\n')}`,
      ephemeral: true,
    });
    return;
  }

  const ranks = await prisma.organizationRank.findMany({
    where: { organizationId: organization.id },
    orderBy: { level: 'asc' },
  });

  await interaction.editReply({
    content: ranks.length
      ? `**Должности организации ${organization.name}:**\n${ranks.map((rank) => `**${rank.level}.** ${rank.name}`).join('\n')}`
      : 'Для этой организации должности ещё не настроены.',
    ephemeral: true,
  });
}

async function createOrganization(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const name = interaction.options.getString('name', true).trim();
  const code = cleanCode(interaction.options.getString('code', true));
  const type = interaction.options.getString('type', true);
  const description =
    interaction.options.getString('description')?.trim() || null;

  if (name.length < 2) {
    await interaction.reply({
      content: 'Название организации должно содержать не менее 2 символов.',
      ephemeral: true,
    });
    return;
  }

  if (!isValidCode(code)) {
    await interaction.reply({
      content: 'Некорректный код. Используйте 2–16 символов: буквы, цифры, дефис или подчёркивание.',
      ephemeral: true,
    });
    return;
  }

  if (type !== 'GOVERNMENT' && type !== 'COMMERCIAL') {
    await interaction.reply({
      content: 'Неизвестный тип организации.',
      ephemeral: true,
    });
    return;
  }

  try {
    const organization = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name,
          code,
          type,
          description,
          status: 'ACTIVE',
        },
      });

      await tx.auditLog.create({
        data: {
          actorDiscordId: interaction.user.id,
          action: 'ORG_CREATE',
          targetType: 'ORGANIZATION',
          targetId: created.id,
          outcome: 'SUCCESS',
          details: {
            name: created.name,
            code: created.code,
            type: created.type,
          },
        },
      });

      return created;
    });

    const typeLabel =
      organization.type === 'GOVERNMENT' ? 'Государственная' : 'Коммерческая';

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x16a34a)
          .setTitle('Организация создана')
          .setDescription(`**${organization.name}**`)
          .addFields(
            { name: 'Код', value: organization.code, inline: true },
            { name: 'Тип', value: typeLabel, inline: true },
            { name: 'Статус', value: 'Активна', inline: true },
            {
              name: 'Описание',
              value: organization.description ?? 'Не указано',
            },
          )
          .setFooter({ text: 'RedLine RolePlay • Игровая система' })
          .setTimestamp(organization.createdAt),
      ],
      ephemeral: true,
    });
  } catch (error) {
    const isUniqueConflict =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002';

    await interaction.reply({
      content: isUniqueConflict
        ? `Организация с кодом **${code}** уже существует. Выберите другой код.`
        : 'Не удалось создать организацию. Проверьте подключение к базе данных и журнал сервера.',
      ephemeral: true,
    });

    if (!isUniqueConflict) {
      console.error('[RedLine Bot] Ошибка создания организации:', error);
    }
  }
}

async function listOrganizations(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const organizations = await prisma.organization.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { name: 'asc' },
    take: 25,
  });

  if (organizations.length === 0) {
    await interaction.reply({
      content: 'Активных организаций пока нет. Создать организацию можно командой `/org create`.',
      ephemeral: true,
    });
    return;
  }

  const lines = organizations.map((organization) => {
    const type =
      organization.type === 'GOVERNMENT' ? 'Государственная' : 'Коммерческая';
    return `• **${organization.name}** — ${type} · Код: \`${organization.code}\``;
  });

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xdc2626)
        .setTitle('Реестр организаций')
        .setDescription(lines.join('\n'))
        .setFooter({
          text: `Показано ${organizations.length} из максимум 25 активных организаций`,
        }),
    ],
    ephemeral: true,
  });
}

async function viewOrganization(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const code = cleanCode(interaction.options.getString('code', true));

  const organization = await prisma.organization.findUnique({
    where: { code },
    include: {
      _count: {
        select: { members: true, ranks: true },
      },
    },
  });

  if (!organization) {
    await interaction.reply({
      content: `Организация с кодом **${code}** не найдена.`,
      ephemeral: true,
    });
    return;
  }

  const type =
    organization.type === 'GOVERNMENT' ? 'Государственная' : 'Коммерческая';
  const statusLabels: Record<string, string> = {
    ACTIVE: 'Активна',
    INACTIVE: 'Неактивна',
    ARCHIVED: 'В архиве',
  };

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(organization.status === 'ACTIVE' ? 0xdc2626 : 0x6b7280)
        .setTitle(organization.name)
        .setDescription(organization.description ?? 'Описание не указано.')
        .addFields(
          { name: 'Код', value: organization.code, inline: true },
          { name: 'Тип', value: type, inline: true },
          {
            name: 'Статус',
            value: statusLabels[organization.status] ?? organization.status,
            inline: true,
          },
          { name: 'Сотрудники', value: String(organization._count.members), inline: true },
          { name: 'Должности', value: String(organization._count.ranks), inline: true },
          {
            name: 'Создана',
            value: `<t:${Math.floor(organization.createdAt.getTime() / 1000)}:f>`,
            inline: false,
          },
        )
        .setFooter({ text: 'RedLine RolePlay • Игровая система' }),
    ],
    ephemeral: true,
  });
}

export async function handleButton(
  interaction: ButtonInteraction,
): Promise<void> {
  if (!interaction.customId.startsWith('panel:')) return;

  const section = interaction.customId.split(':')[1];
  const labels: Record<string, string> = {
    organizations:
      'Управление организациями: используйте `/org list`, `/org view` или `/org create`.',
    employees: 'Кадровый модуль будет подключён на следующем этапе.',
    documents: 'Документооборот будет подключён на следующем этапе.',
  };

  await interaction.reply({
    content: labels[section] ?? 'Раздел пока недоступен.',
    ephemeral: true,
  });
}
