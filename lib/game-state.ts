import { Player, Commentary, initialPlayers } from '@/app/game-data';

export interface GameState {
  players: Player[];
  score: { home: number; away: number };
  commentary: Commentary[];
  timeLeft: number;
  isGameActive: boolean;
  gameHasStarted: boolean;
}

export interface GameEvent {
  type: 'player-stat-update' | 'score-update' | 'new-comment' | 'game-status-update' | 'reset';
  data?: any;
}

export function createInitialGameState(): GameState {
  return {
    players: [...initialPlayers],
    score: { home: 0, away: 0 },
    commentary: [],
    timeLeft: 120, // 2 minutes in seconds
    isGameActive: false,
    gameHasStarted: false,
  };
}

export function updateGameState(state: GameState, event: GameEvent): GameState {
  const newState = { ...state };

  switch (event.type) {
    case 'player-stat-update':
      const playerIndex = newState.players.findIndex(p => p.id === event.data.playerId);
      if (playerIndex !== -1) {
        newState.players[playerIndex] = {
          ...newState.players[playerIndex],
          stats: event.data.stats,
        };
      }
      break;

    case 'score-update':
      newState.score = event.data;
      break;

    case 'new-comment':
      newState.commentary = [event.data, ...newState.commentary].slice(0, 50);
      break;

    case 'game-status-update':
      if (event.data.timeLeft !== undefined) {
        newState.timeLeft = event.data.timeLeft;
      }
      if (event.data.isGameActive !== undefined) {
        newState.isGameActive = event.data.isGameActive;
        if (event.data.isGameActive && !newState.gameHasStarted) {
          newState.gameHasStarted = true;
        }
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
  const minute = Math.floor((120 - state.timeLeft) / 60);
  
  switch (event.type) {
    case 'player-stat-update':
      const player = state.players.find(p => p.id === event.data.playerId);
      if (!player) return '';
      
      const stat = event.data.statType;
      const team = player.team;
      
      return JSON.stringify({
        type: stat === 'goals' ? 'goal' : 
              stat === 'yellowCards' ? 'yellow_card' : 
              stat === 'redCards' ? 'red_card' : 
              stat === 'fouls' ? 'foul' : stat,
        player: player.name,
        team: team,
        minute: minute,
      });
      
    case 'score-update':
      return JSON.stringify({
        type: 'score_update',
        score: event.data,
        minute: minute,
      });
      
    case 'game-status-update':
      if (event.data.isGameActive === true && !state.isGameActive) {
        return JSON.stringify({
          type: 'kickoff',
          minute: 0,
        });
      }
      if (event.data.isGameActive === false && state.isGameActive) {
        return JSON.stringify({
          type: 'fulltime',
          minute: minute,
        });
      }
      break;
  }
  
  return '';
}