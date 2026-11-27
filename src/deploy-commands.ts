import { REST, Routes } from 'discord.js';
import { env } from './config.js';
import { commandDefinitions } from './bot/commands.js';

const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

await rest.put(
  Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID),
  { body: commandDefinitions.map(command => command.toJSON()) },
);

console.log('[RedLine Bot] Команды зарегистрированы в тестовом Discord-сервере.');
