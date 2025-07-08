import { Router, Request, Response } from 'express';
import { getGameState } from '../services/ably-service.js';

export function createAdminRouter(): Router {
  const router = Router();
  
  router.get('/admin/status', (req: Request, res: Response) => {
    const gameState = getGameState();
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
      },
      gameState: {
        score: gameState.score,
        timeLeft: gameState.timeLeft,
        isGameActive: gameState.isGameActive,
        gameHasStarted: gameState.gameHasStarted,
      },
      config: {
        mainChannel: process.env.MAIN_CHANNEL || 'football-frenzy:production:main',
        commentaryChannel: process.env.COMMENTARY_CHANNEL || 'football-frenzy:production:commentary',
      },
    });
  });
  
  return router;
}