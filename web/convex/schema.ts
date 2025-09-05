import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  rooms: defineTable({
    roomCode: v.string(),
    state: v.any(),
    player1Session: v.optional(v.string()),
    player2Session: v.optional(v.string()),
    names: v.record(v.string(), v.string()),
    recentActionIds: v.array(v.string())
  }).index('roomCode', ['roomCode'])
});

