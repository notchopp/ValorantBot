import fs from 'fs';
import path from 'path';
import puppeteer, { Browser } from 'puppeteer-core';

export interface RankProfileData {
  playerName: string;
  discordId: string;
  avatarUrl?: string;
  gameLabel?: string;
  rankName: string;
  rankMMR: number;
  stats?: {
    wins?: number;
    losses?: number;
    winrate?: string;
    kills?: number;
    deaths?: number;
    kd?: string;
    mvp?: number;
    svp?: number;
    games?: number;
  };
  progress?: {
    percent: number;
    text: string;
  };
  roles?: Array<{ name: string; stats: string }>;
  recentGames?: Array<{
    title: string;
    meta: string;
    result: 'win' | 'loss';
    mmrChange: string;
  }>;
}

export class RankProfileImageService {
  private htmlTemplate: string | null = null;

  async renderProfile(data: RankProfileData): Promise<Buffer> {
    const html = this.getTemplate();
    const browser = await this.launchBrowser();
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 800 });
      await page.setContent(html, { waitUntil: 'load' });

      await page.evaluate((payload) => {
        const doc = (globalThis as any).document as any;
        const setText = (selector: string, value?: string) => {
          const el = doc.querySelector(selector);
          if (el && value !== undefined) {
            el.textContent = value;
          }
        };

        setText('[data-player-name]', payload.playerName);
        setText('[data-discord-id]', `Discord: ${payload.discordId}`);
        setText('[data-rank-name]', payload.rankName);
        setText('[data-rank-mmr]', `${payload.rankMMR} MMR`);

        const rankIcon = doc.querySelector('[data-rank-icon]');
        if (rankIcon) {
          const iconText = payload.rankName ? payload.rankName.substring(0, 1).toUpperCase() : '?';
          rankIcon.textContent = iconText;
        }

        const avatarContainer = doc.querySelector('[data-avatar]');
        if (avatarContainer) {
          if (payload.avatarUrl) {
            avatarContainer.innerHTML = `<img src="${payload.avatarUrl}" alt="avatar" />`;
          } else {
            const fallback = avatarContainer.querySelector('.avatar-fallback');
            if (fallback) {
              fallback.textContent = payload.playerName.substring(0, 1).toUpperCase();
            }
          }
        }

        const gameBadge = doc.querySelector('[data-game-type]');
        if (gameBadge) {
          if (payload.gameLabel) {
            gameBadge.textContent = payload.gameLabel;
            gameBadge.style.display = 'inline-block';
          } else {
            gameBadge.style.display = 'none';
          }
        }

        const stats = payload.stats || {};
        const statMap: Record<string, string> = {
          wins: String(stats.wins ?? 0),
          losses: String(stats.losses ?? 0),
          winrate: stats.winrate ?? '0%',
          kills: String(stats.kills ?? 0),
          deaths: String(stats.deaths ?? 0),
          kd: stats.kd ?? '0.00',
          mvp: String(stats.mvp ?? 0),
          svp: String(stats.svp ?? 0),
          games: String(stats.games ?? 0),
        };
        Object.entries(statMap).forEach(([key, value]) => {
          setText(`[data-stat="${key}"]`, value);
        });

        const progressSection = doc.querySelector('[data-progress-section]');
        if (progressSection) {
          if (payload.progress) {
            progressSection.style.display = 'block';
            setText('[data-progress-text]', payload.progress.text);
            const fill = doc.querySelector('[data-progress-fill]');
            if (fill) {
              fill.style.width = `${payload.progress.percent}%`;
            }
          } else {
            progressSection.style.display = 'none';
          }
        }

        const roleList = doc.querySelector('[data-role-list]');
        if (roleList) {
          if (payload.roles && payload.roles.length > 0) {
            roleList.innerHTML = payload.roles
              .map(
                (role) =>
                  `<div class="role-item"><span class="role-name">${role.name}</span><span class="role-stats">${role.stats}</span></div>`
              )
              .join('');
          } else {
            roleList.innerHTML = '<div class="role-item"><span class="role-name">No data</span><span class="role-stats">—</span></div>';
          }
        }

        const gamesList = doc.querySelector('[data-games-list]');
        if (gamesList) {
          if (payload.recentGames && payload.recentGames.length > 0) {
            gamesList.innerHTML = payload.recentGames
              .map(
                (game) =>
                  `<div class="game-item ${game.result}">` +
                  `<div class="game-icon">${game.result.toUpperCase()}</div>` +
                  `<div class="game-info"><div class="game-title">${game.title}</div><div class="game-meta">${game.meta}</div></div>` +
                  `<div class="game-result"><span class="result-badge ${game.result}">${game.result.toUpperCase()}</span></div>` +
                  `<div class="mmr-change ${game.result === 'win' ? 'positive' : 'negative'}">${game.mmrChange}</div>` +
                  `</div>`
              )
              .join('');
          } else {
            gamesList.innerHTML = '<div class="game-item"><div class="game-icon">N/A</div><div class="game-info"><div class="game-title">No recent games</div><div class="game-meta">—</div></div><div class="game-result"><span class="result-badge loss">—</span></div><div class="mmr-change">0</div></div>';
          }
        }
      }, data);

      const screenshot = await page.screenshot({ type: 'png' });
      return Buffer.isBuffer(screenshot) ? screenshot : Buffer.from(screenshot);
    } finally {
      await browser.close();
    }
  }

  private getTemplate(): string {
    if (this.htmlTemplate) {
      return this.htmlTemplate;
    }
    const templatePath = path.resolve(process.cwd(), 'public', 'rank-profile.html');
    this.htmlTemplate = fs.readFileSync(templatePath, 'utf8');
    return this.htmlTemplate;
  }

  private async launchBrowser(): Promise<Browser> {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROMIUM_PATH;
    return puppeteer.launch({
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
}
