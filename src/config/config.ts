export interface Config {
  bot: {
    token: string;
    clientId: string;
    guildId?: string;
  };
  valorantAPI: {
    enabled: boolean;
    defaultRegion: string;
    apiKey?: string;
  };
  queue: {
    maxPlayers: number;
    minPlayers: number;
  };
  ranks: {
    roleNames: string[];
    numericValues: Record<string, number>;
  };
  maps: string[];
  points: {
    win: number;
    loss: number;
    mvp: number;
  };
  teamBalancing: {
    defaultMode: 'auto' | 'captain';
  };
}

export const defaultConfig: Config = {
  bot: {
    token: process.env.DISCORD_BOT_TOKEN || '',
    clientId: process.env.DISCORD_CLIENT_ID || '',
    guildId: process.env.DISCORD_GUILD_ID,
  },
  valorantAPI: {
    enabled: process.env.VALORANT_API_ENABLED !== 'false',
    defaultRegion: process.env.VALORANT_DEFAULT_REGION || 'na',
    apiKey: process.env.VALORANT_API_KEY,
  },
  queue: {
    maxPlayers: 10,
    minPlayers: 10,
  },
  ranks: {
    roleNames: [
      'Iron',
      'Bronze',
      'Silver',
      'Gold',
      'Platinum',
      'Diamond',
      'Ascendant',
      'Immortal',
      'Radiant',
    ],
    numericValues: {
      Iron: 1,
      Bronze: 2,
      Silver: 3,
      Gold: 4,
      Platinum: 5,
      Diamond: 6,
      Ascendant: 7,
      Immortal: 8,
      Radiant: 9,
    },
  },
  maps: [
    'Bind',
    'Haven',
    'Split',
    'Ascent',
    'Icebox',
    'Breeze',
    'Fracture',
    'Pearl',
    'Lotus',
    'Sunset',
    'Abyss',
  ],
  points: {
    win: 25,
    loss: -10,
    mvp: 5,
  },
  teamBalancing: {
    defaultMode: 'auto',
  },
};
