export interface GameData {
  gameId: string;
  playerId: string;
  data: any; // The actual game state
  createdAt: number;
  lastUpdated: number;
  expiresAt: number;
}

export interface GameIndex {
  gameId: string;
  playerId: string;
  createdAt: number;
  lastUpdated: number;
  expiresAt: number;
  size: number;
}

export class GamePersistence {
  private state: DurableObjectState;
  private env: any;
  private lastCleanup: number = 0;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    
    // Maybe run cleanup (throttled to once every 6 hours)
    await this.maybeCleanup();
    
    try {
      switch (url.pathname) {
        case '/save':
          if (method !== 'POST') return new Response('Method not allowed', { status: 405 });
          return await this.saveGame(request);
        
        case '/load':
          if (method !== 'GET') return new Response('Method not allowed', { status: 405 });
          return await this.loadGame(request);
        
        case '/delete':
          if (method !== 'DELETE') return new Response('Method not allowed', { status: 405 });
          return await this.deleteGame(request);
        
        case '/cleanup':
          if (method !== 'POST') return new Response('Method not allowed', { status: 405 });
          return await this.manualCleanup();
        
        case '/stats':
          if (method !== 'GET') return new Response('Method not allowed', { status: 405 });
          return await this.getStats();
        
        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error('GamePersistence error:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }

  private async saveGame(request: Request): Promise<Response> {
    const { gameId, playerId, data } = await request.json() as { gameId: string; playerId: string; data: any; };
    
    if (!gameId || !playerId || !data) {
      return new Response('Missing required fields: gameId, playerId, data', { status: 400 });
    }

    const now = Date.now();
    const gameData: GameData = {
      gameId,
      playerId,
      data,
      createdAt: now,
      lastUpdated: now,
      expiresAt: now + (24 * 60 * 60 * 1000) // 1 day
    };

    // Save the full game data
    await this.state.storage.put(`game:${gameId}:${playerId}`, gameData);
    
    // Update the index
    await this.updateIndex(gameId, playerId, gameData);

    return new Response(JSON.stringify({ success: true, gameId, playerId }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async loadGame(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const gameId = url.searchParams.get('gameId');
    const playerId = url.searchParams.get('playerId');

    if (!gameId || !playerId) {
      return new Response('Missing gameId or playerId parameters', { status: 400 });
    }

    const gameData = await this.state.storage.get<GameData>(`game:${gameId}:${playerId}`);
    
    if (!gameData) {
      return new Response('Game not found', { status: 404 });
    }

    // Check if game has expired
    if (gameData.expiresAt < Date.now()) {
      await this.deleteGameById(gameId, playerId);
      return new Response('Game expired', { status: 404 });
    }

    // Update last accessed time
    gameData.lastUpdated = Date.now();
    await this.state.storage.put(`game:${gameId}:${playerId}`, gameData);
    await this.updateIndex(gameId, playerId, gameData);

    return new Response(JSON.stringify(gameData.data), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async deleteGame(request: Request): Promise<Response> {
    const { gameId, playerId } = await request.json() as { gameId: string; playerId: string; };
    
    if (!gameId || !playerId) {
      return new Response('Missing gameId or playerId', { status: 400 });
    }

    const deleted = await this.deleteGameById(gameId, playerId);
    
    return new Response(JSON.stringify({ success: deleted }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async deleteGameById(gameId: string, playerId: string): Promise<boolean> {
    const key = `game:${gameId}:${playerId}`;
    const existed = await this.state.storage.get(key) !== undefined;
    
    if (existed) {
      await this.state.storage.delete(key);
      await this.removeFromIndex(gameId, playerId);
    }
    
    return existed;
  }

  private async updateIndex(gameId: string, playerId: string, gameData: GameData): Promise<void> {
    const index = await this.getIndex();
    const key = `${gameId}:${playerId}`;
    
    index[key] = {
      gameId,
      playerId,
      createdAt: gameData.createdAt,
      lastUpdated: gameData.lastUpdated,
      expiresAt: gameData.expiresAt,
      size: JSON.stringify(gameData.data).length
    };
    
    await this.state.storage.put('game-index', index);
  }

  private async removeFromIndex(gameId: string, playerId: string): Promise<void> {
    const index = await this.getIndex();
    const key = `${gameId}:${playerId}`;
    delete index[key];
    await this.state.storage.put('game-index', index);
  }

  private async getIndex(): Promise<Record<string, GameIndex>> {
    return await this.state.storage.get<Record<string, GameIndex>>('game-index') || {};
  }

  private async manualCleanup(): Promise<Response> {
    const cleanedCount = await this.performCleanup();
    
    return new Response(JSON.stringify({ 
      success: true, 
      cleanedGames: cleanedCount,
      timestamp: Date.now()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async performCleanup(): Promise<number> {
    const now = Date.now();
    const index = await this.getIndex();
    let cleanedCount = 0;

    // Find expired games
    const expiredGames: string[] = [];
    for (const [key, gameIndex] of Object.entries(index)) {
      if (gameIndex.expiresAt < now) {
        expiredGames.push(key);
        const [gameId, playerId] = key.split(':');
        await this.deleteGameById(gameId, playerId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 GamePersistence cleaned up ${cleanedCount} expired games`);
    }

    return cleanedCount;
  }

  private async getStats(): Promise<Response> {
    const index = await this.getIndex();
    const now = Date.now();
    
    let totalGames = 0;
    let expiredGames = 0;
    let totalSize = 0;
    let oldestGame = now;
    let newestGame = 0;

    for (const gameIndex of Object.values(index)) {
      totalGames++;
      totalSize += gameIndex.size;
      
      if (gameIndex.expiresAt < now) {
        expiredGames++;
      }
      
      if (gameIndex.createdAt < oldestGame) {
        oldestGame = gameIndex.createdAt;
      }
      
      if (gameIndex.createdAt > newestGame) {
        newestGame = gameIndex.createdAt;
      }
    }

    const stats = {
      totalGames,
      expiredGames,
      activeGames: totalGames - expiredGames,
      totalSizeBytes: totalSize,
      totalSizeKB: Math.round(totalSize / 1024),
      oldestGameAge: totalGames > 0 ? Math.round((now - oldestGame) / (24 * 60 * 60 * 1000)) : 0,
      newestGameAge: totalGames > 0 ? Math.round((now - newestGame) / (24 * 60 * 60 * 1000)) : 0,
      timestamp: now
    };

    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Called periodically to clean up expired data
  private async maybeCleanup(): Promise<void> {
    const now = Date.now();
    const sixHours = 6 * 60 * 60 * 1000; // 6 hours in ms
    
    // Only run cleanup if it's been more than 6 hours since last cleanup
    if (now - this.lastCleanup > sixHours) {
      await this.performCleanup();
      this.lastCleanup = now;
    }
  }
}