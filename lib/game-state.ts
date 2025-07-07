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
  data?: any;
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
      const playerIndex = newState.players.findIndex(p => p.id === event.data.playerId);
      if (playerIndex !== -1) {
        // Support both 'stats' and 'newStats' field names for compatibility
        const updatedStats = event.data.stats || event.data.newStats;
        if (updatedStats) {
          newState.players[playerIndex] = {
            ...newState.players[playerIndex],
            stats: updatedStats,
          };
        }
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

    case 'time-update':
      newState.timeLeft = event.data.timeLeft;
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
      const player = state.players.find(p => p.id === event.data.playerId);
      if (!player) return '';
      
      // Get new stats directly from event
      const newStats = event.data.stats || event.data.newStats;
      if (!newStats) return '';
      
      // Determine what changed by looking at the stats
      let eventType = '';
      const oldPlayer = state.players.find(p => p.id === event.data.playerId);
      if (oldPlayer && newStats) {
        const oldStats = oldPlayer.stats;
        console.log('[FormatEvent] Comparing stats:', {
          playerId: event.data.playerId,
          playerName: player.name,
          oldStats,
          newStats,
          goalsChanged: newStats.goals > oldStats.goals,
          yellowCardsChanged: newStats.yellowCards > oldStats.yellowCards,
          redCardsChanged: newStats.redCards > oldStats.redCards,
          assistsChanged: newStats.assists > oldStats.assists,
          savesChanged: newStats.saves > oldStats.saves,
        });
        if (newStats.goals > oldStats.goals) eventType = 'goal';
        else if (newStats.yellowCards > oldStats.yellowCards) eventType = 'yellow_card';
        else if (newStats.redCards > oldStats.redCards) eventType = 'red_card';
        else if (newStats.assists > oldStats.assists) eventType = 'assist';
        else if (newStats.saves > oldStats.saves) eventType = 'save';
      }
      
      if (!eventType) return '';
      
      return JSON.stringify({
        type: eventType,
        player: player.name,
        team: player.team || 'home',
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
      if (event.data.isGameActive === false && state.isGameActive && state.timeLeft === 0) {
        return JSON.stringify({
          type: 'fulltime',
          minute: minute,
          finalScore: state.score,
        });
      }
      break;
  }
  
  return '';
}