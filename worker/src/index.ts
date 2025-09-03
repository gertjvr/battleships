import { GameRoom } from './game-room';
import { GamePersistence } from './game-persistence';

export interface Env {
  GAME_ROOMS: DurableObjectNamespace;
  GAME_PERSISTENCE: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/ws') {
      const room = url.searchParams.get('room');
      if (!room || !/^[A-Z0-9]{6,8}$/.test(room)) {
        return new Response('Invalid room parameter (6-8 alphanumeric characters required)', { status: 400 });
      }
      
      // Use idFromName for deterministic room codes
      const id = env.GAME_ROOMS.idFromName(room);
      const stub = env.GAME_ROOMS.get(id);
      return stub.fetch(request);
    }
    
    // Game persistence endpoints
    if (url.pathname.startsWith('/persistence/')) {
      const playerId = url.searchParams.get('playerId') || 'default';
      // Use a consistent ID for the persistence object per player
      const id = env.GAME_PERSISTENCE.idFromName(`persistence-${playerId}`);
      const stub = env.GAME_PERSISTENCE.get(id);
      
      // Forward the request with the persistence path removed
      const persistenceUrl = new URL(request.url);
      persistenceUrl.pathname = persistenceUrl.pathname.replace('/persistence', '');
      
      const persistenceRequest = new Request(persistenceUrl, request);
      return stub.fetch(persistenceRequest);
    }
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }
    
    return new Response('Not found', { status: 404 });
  },
  
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Run cleanup across all persistence instances
    console.log('Running scheduled cleanup task');
    
    // We could trigger cleanup on all known persistence instances
    // For now, the cleanup will happen per-player when they access their games
    // Future enhancement: maintain a registry of active persistence instances
    
    console.log('Scheduled cleanup completed');
  }
};

export { GameRoom, GamePersistence };