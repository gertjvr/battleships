import { Migrations } from '@convex-dev/migrations';
import { components } from './_generated/api';
import type { DataModel } from './_generated/dataModel';

export const migrations = new Migrations<DataModel>(components.migrations);

// Stateful migration: backfill missing/invalid `updatedAt` on rooms
export const backfillRoomsUpdatedAt = migrations.define({
  table: 'rooms',
  migrateOne: (_ctx, room: any) => {
    const hasValid = typeof room.updatedAt === 'number' && !Number.isNaN(room.updatedAt);
    if (hasValid) return;
    const candidates: number[] = [];
    if (typeof room.player1LastSeen === 'number') candidates.push(room.player1LastSeen);
    if (typeof room.player2LastSeen === 'number') candidates.push(room.player2LastSeen);
    const fallback = candidates.length ? Math.max(...candidates) : Date.now();
    return { updatedAt: fallback };
  }
});

// Runners for CLI usage
export const runAll = migrations.runner([
  // Add future migrations here in order
  // e.g., internal.migrations.anotherMigration,
  // For now, just the backfill
  (backfillRoomsUpdatedAt as unknown) as any
]);

export const run = migrations.runner();
