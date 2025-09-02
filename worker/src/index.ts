import { GameRoom } from './game-room';

export interface Env {
  GAME_ROOMS: DurableObjectNamespace;
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
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }
    
    return new Response('Not found', { status: 404 });
  }
};

export { GameRoom };