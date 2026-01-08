import { Player } from './Player';

export interface Queue {
  players: Player[];
  isLocked: boolean;
  createdAt: Date;
}

export function createQueue(): Queue {
  return {
    players: [],
    isLocked: false,
    createdAt: new Date(),
  };
}

export function addPlayerToQueue(queue: Queue, player: Player): boolean {
  if (queue.isLocked) {
    return false;
  }
  if (queue.players.some((p) => p.userId === player.userId)) {
    return false;
  }
  queue.players.push(player);
  return true;
}

export function removePlayerFromQueue(queue: Queue, userId: string): boolean {
  if (queue.isLocked) {
    return false;
  }
  const index = queue.players.findIndex((p) => p.userId === userId);
  if (index === -1) {
    return false;
  }
  queue.players.splice(index, 1);
  return true;
}

export function isQueueFull(queue: Queue, maxPlayers: number): boolean {
  return queue.players.length >= maxPlayers;
}
