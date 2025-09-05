import { internalMutation } from './_generated/server';

// Backfill `updatedAt` for existing rooms.
// Run once in prod, then switch `updatedAt` back to required in schema.
export const backfillRoomsUpdatedAt = internalMutation({
  args: {},
  handler: async ctx => {
    const now = Date.now();
    const rooms = await ctx.db.query('rooms').collect();
    let scanned = 0;
    let updated = 0;

    for (const room of rooms) {
      scanned++;
      const hasValid = typeof (room as any).updatedAt === 'number' && !Number.isNaN((room as any).updatedAt);
      if (!hasValid) {
        // Prefer a sensible historical timestamp if available; otherwise use `now`.
        const candidates: number[] = [];
        if (typeof (room as any).player1LastSeen === 'number') candidates.push((room as any).player1LastSeen);
        if (typeof (room as any).player2LastSeen === 'number') candidates.push((room as any).player2LastSeen);
        const fallback = candidates.length ? Math.max(...candidates) : now;
        await ctx.db.patch(room._id, { updatedAt: fallback });
        updated++;
      }
    }

    return { scanned, updated };
  }
});

