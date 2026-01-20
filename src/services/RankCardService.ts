import { createCanvas, loadImage } from '@napi-rs/canvas';

export type RankCardGame = 'valorant' | 'marvel_rivals' | 'combined';

export interface RankCardData {
  username: string;
  avatarUrl?: string;
  game: RankCardGame;
  discordRank: string;
  discordMMR: number;
  valorantRank?: string;
  valorantMMR?: number;
  marvelRank?: string;
  marvelMMR?: number;
}

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 675;
type CanvasContext = ReturnType<typeof createCanvas> extends { getContext: (...args: any[]) => infer R }
  ? R
  : never;

export class RankCardService {
  async createRankCard(data: RankCardData): Promise<Buffer> {
    const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
    const ctx = canvas.getContext('2d');

    this.drawBackground(ctx);
    this.drawHeader(ctx, data);
    this.drawRankBadge(ctx, data.discordRank, data.discordMMR);
    this.drawGamePanels(ctx, data);
    await this.drawAvatar(ctx, data.avatarUrl);

    return canvas.toBuffer('image/png');
  }

  private drawBackground(ctx: CanvasContext) {
    const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    gradient.addColorStop(0, '#0b1020');
    gradient.addColorStop(0.45, '#1c2140');
    gradient.addColorStop(1, '#2b1d3d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#7a4bff';
    ctx.beginPath();
    ctx.moveTo(820, 0);
    ctx.lineTo(CARD_WIDTH, 0);
    ctx.lineTo(CARD_WIDTH, 260);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#00d1ff';
    ctx.beginPath();
    ctx.moveTo(0, 480);
    ctx.lineTo(440, CARD_HEIGHT);
    ctx.lineTo(0, CARD_HEIGHT);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawHeader(ctx: CanvasContext, data: RankCardData) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px sans-serif';
    ctx.fillText(data.username, 140, 90);

    ctx.fillStyle = '#a2b3ff';
    ctx.font = '600 20px sans-serif';
    ctx.fillText('GRNDS RANK CARD', 140, 122);

    ctx.fillStyle = '#8f9bd9';
    ctx.font = '600 16px sans-serif';
    ctx.fillText(`Mode: ${this.formatGameLabel(data.game)}`, 140, 150);
  }

  private drawRankBadge(ctx: CanvasContext, rank: string, mmr: number) {
    const badgeX = CARD_WIDTH - 260;
    const badgeY = 60;
    const badgeWidth = 200;
    const badgeHeight = 90;
    const badgeColor = this.getRankColor(rank);

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    this.roundedRect(ctx, badgeX - 8, badgeY - 8, badgeWidth + 16, badgeHeight + 16, 18);
    ctx.fill();

    ctx.fillStyle = badgeColor;
    this.roundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 16);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(rank.toUpperCase(), badgeX + 16, badgeY + 34);

    ctx.fillStyle = '#0b1020';
    ctx.font = '700 18px sans-serif';
    ctx.fillText(`${mmr} MMR`, badgeX + 16, badgeY + 64);
  }

  private drawGamePanels(ctx: CanvasContext, data: RankCardData) {
    const panelY = 200;
    const panelHeight = 150;
    const panelGap = 24;
    const panelWidth = (CARD_WIDTH - 120 - panelGap) / 2;
    const panelX = 60;

    this.drawPanel(ctx, panelX, panelY, panelWidth, panelHeight, 'Valorant', data.valorantRank, data.valorantMMR);
    this.drawPanel(ctx, panelX + panelWidth + panelGap, panelY, panelWidth, panelHeight, 'Marvel Rivals', data.marvelRank, data.marvelMMR);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 24px sans-serif';
    ctx.fillText('Discord Role', 60, panelY + panelHeight + 70);

    ctx.fillStyle = '#c6d4ff';
    ctx.font = '600 18px sans-serif';
    ctx.fillText(`${data.discordRank} • ${data.discordMMR} MMR`, 60, panelY + panelHeight + 102);
  }

  private drawPanel(
    ctx: CanvasContext,
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    rank?: string,
    mmr?: number
  ) {
    ctx.fillStyle = 'rgba(10, 12, 22, 0.65)';
    this.roundedRect(ctx, x, y, width, height, 18);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 20px sans-serif';
    ctx.fillText(title, x + 20, y + 34);

    ctx.fillStyle = '#9fb1ff';
    ctx.font = '600 16px sans-serif';
    ctx.fillText(rank ? rank : 'Unranked', x + 20, y + 70);

    ctx.fillStyle = '#6f7cc0';
    ctx.font = '600 14px sans-serif';
    ctx.fillText(`${mmr ?? 0} MMR`, x + 20, y + 98);
  }

  private async drawAvatar(ctx: CanvasContext, avatarUrl?: string) {
    const x = 40;
    const y = 40;
    const size = 84;

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 + 6, 0, Math.PI * 2);
    ctx.fill();

    if (!avatarUrl) {
      return;
    }

    try {
      const image = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(image, x, y, size, size);
      ctx.restore();
    } catch (error) {
      console.warn('Failed to load avatar image', { avatarUrl });
    }
  }

  private roundedRect(
    ctx: CanvasContext,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  private getRankColor(rank: string): string {
    const upper = rank.toUpperCase();
    if (upper.startsWith('GRNDS')) return '#8a8fa6';
    if (upper.startsWith('BREAKPOINT')) return '#4a90e2';
    if (upper.startsWith('CHALLENGER')) return '#ff6b6b';
    if (upper === 'X') return '#f5c542';
    return '#6c6f85';
  }

  private formatGameLabel(game: RankCardGame): string {
    if (game === 'marvel_rivals') return 'Marvel Rivals';
    if (game === 'combined') return 'Combined';
    return 'Valorant';
  }
}
