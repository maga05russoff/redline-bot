import { Client, GatewayIntentBits, Events } from 'discord.js';
import { env } from './config.js';
import { handleButton, handleCommand } from './bot/commands.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, readyClient => {
  console.log(`[RedLine Bot] Авторизован как ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) await handleCommand(interaction);
    else if (interaction.isButton()) await handleButton(interaction);
  } catch (error) {
    console.error('[RedLine Bot] Ошибка обработки взаимодействия:', error);
    const message = 'Произошла внутренняя ошибка. Событие записано в журнал.';
    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: message, ephemeral: true }).catch(() => undefined);
      } else {
        await interaction.reply({ content: message, ephemeral: true }).catch(() => undefined);
      }
    }
  }
});

process.on('SIGINT', async () => {
  await client.destroy();
  process.exit(0);
});

client.login(env.DISCORD_TOKEN);
