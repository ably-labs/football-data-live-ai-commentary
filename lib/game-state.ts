import { Player, Commentary, initialPlayers } from '@/app/game-data';
import { GAME_DURATION_SECONDS } from './constants';

export interface GameState {
  players: Player[];
  score: { home: number; away: number };
  commentary: Commentary[];
  timeLeft: number;
  isGameActive: boolean;
  gameHasStarted: boolean;
}

export interface GameEvent {
  type: 'player-stat-update' | 'score-update' | 'new-comment' | 'game-status-update' | 'time-update' | 'reset';
  data?: {
    playerId?: number;
    stats?: Player['stats'];
    newStats?: Player['stats'];
    home?: number;
    away?: number;
    timeLeft?: number;
    isGameActive?: boolean;
  } | Player['stats'] | Commentary | { home: number; away: number };
}

export function createInitialGameState(): GameState {
  return {
    players: [...initialPlayers],
    score: { home: 0, away: 0 },
    commentary: [],
    timeLeft: GAME_DURATION_SECONDS,
    isGameActive: false,
    gameHasStarted: false,
  };
}

export function updateGameState(state: GameState, event: GameEvent): GameState {
  const newState = { ...state };

  switch (event.type) {
    case 'player-stat-update':
      if (event.data && typeof event.data === 'object' && 'playerId' in event.data) {
        const data = event.data as { playerId: number; stats?: Player['stats']; newStats?: Player['stats'] };
        const playerIndex = newState.players.findIndex(p => p.id === data.playerId);
        if (playerIndex !== -1) {
          // Support both 'stats' and 'newStats' field names for compatibility
          const updatedStats = data.stats || data.newStats;
          if (updatedStats) {
            newState.players[playerIndex] = {
              ...newState.players[playerIndex],
              stats: updatedStats,
            };
          }
        }
      }
      break;

    case 'score-update':
      if (event.data && typeof event.data === 'object' && 'home' in event.data && 'away' in event.data) {
        newState.score = event.data as { home: number; away: number };
      }
      break;

    case 'new-comment':
      if (event.data) {
        newState.commentary = [event.data as Commentary, ...newState.commentary].slice(0, 50);
      }
      break;

    case 'game-status-update':
      if (event.data && typeof event.data === 'object') {
        const data = event.data as { timeLeft?: number; isGameActive?: boolean };
        if ('timeLeft' in data && data.timeLeft !== undefined) {
          newState.timeLeft = data.timeLeft;
        }
        if ('isGameActive' in data && data.isGameActive !== undefined) {
          newState.isGameActive = data.isGameActive;
          if (data.isGameActive && !newState.gameHasStarted) {
            newState.gameHasStarted = true;
          }
        }
      }
      break;

    case 'time-update':
      if (event.data && typeof event.data === 'object' && 'timeLeft' in event.data) {
        const data = event.data as { timeLeft: number };
        newState.timeLeft = data.timeLeft;
      }
      break;

    case 'reset':
      return createInitialGameState();

    default:
      console.warn('Unknown event type:', event.type);
  }

  return newState;
}

export function formatMatchEvent(event: GameEvent, state: GameState): string {
  // Format events for AI commentary
  const totalSeconds = GAME_DURATION_SECONDS - state.timeLeft;
  const minute = Math.floor(totalSeconds / 60);
  
  switch (event.type) {
    case 'player-stat-update':
      if (!event.data || typeof event.data !== 'object' || !('playerId' in event.data)) return '';
      const data = event.data as { playerId: number; stats?: Player['stats']; newStats?: Player['stats'] };
      const player = state.players.find(p => p.id === data.playerId);
      if (!player) return '';
      
      // Get new stats directly from event
      const newStats = data.stats || data.newStats;
      if (!newStats) return '';
      
      // Determine what changed by looking at the stats
      let eventType = '';
      const oldPlayer = state.players.find(p => p.id === data.playerId);
      if (oldPlayer && newStats) {
        const oldStats = oldPlayer.stats;
        console.log('[FormatEvent] Comparing stats:', {
          playerId: data.playerId,
          playerName: player.name,
          oldStats,
          newStats,
          goalsChanged: newStats.goals > oldStats.goals,
          yellowCardsChanged: newStats.yellowCards > oldStats.yellowCards,
          assistsChanged: newStats.assists > oldStats.assists,
          savesChanged: newStats.saves > oldStats.saves,
        });
        if (newStats.goals > oldStats.goals) eventType = 'goal';
        else if (newStats.yellowCards > oldStats.yellowCards) eventType = 'yellow_card';
        else if (newStats.assists > oldStats.assists) eventType = 'assist';
        else if (newStats.saves > oldStats.saves) eventType = 'save';
      }
      
      if (!eventType) return '';
      
      return JSON.stringify({
        type: eventType,
        player: player.name,
        minute: minute,
      });
      
    case 'score-update':
      if (!event.data) return '';
      return JSON.stringify({
        type: 'score_update',
        score: event.data,
        minute: minute,
      });
      
    case 'game-status-update':
      if (event.data && typeof event.data === 'object' && 'isGameActive' in event.data) {
        const data = event.data as { isGameActive: boolean };
        if (data.isGameActive === true && !state.isGameActive) {
          return JSON.stringify({
            type: 'kickoff',
            minute: 0,
          });
        }
        if (data.isGameActive === false && state.isGameActive && state.timeLeft === 0) {
          return JSON.stringify({
            type: 'fulltime',
            minute: minute,
            finalScore: state.score,
          });
        }
      }
      break;
  }
  
  return '';
}