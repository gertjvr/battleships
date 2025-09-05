import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  rooms: defineTable({
    roomCode: v.string(),
    state: v.any(),
    player1Session: v.optional(v.string()),
    player2Session: v.optional(v.string()),
    names: v.record(v.string(), v.string()),
    recentActionIds: v.array(v.string()),
    // Temporarily optional during rollout; run backfill and then re-require
    updatedAt: v.optional(v.number()),
    player1LastSeen: v.optional(v.number()),
    player2LastSeen: v.optional(v.number())
  }).index('roomCode', ['roomCode'])
});
