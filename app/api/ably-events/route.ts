import { NextResponse } from 'next/server';
import * as Ably from 'ably';
import { createInitialGameState, updateGameState, formatMatchEvent, type GameEvent, type GameState } from '@/lib/game-state';

// Initialize Ably client
let ablyClient: Ably.Realtime | null = null;
let gameState: GameState = createInitialGameState();
let isSubscribed = false;

// Commentary rate limiting
let commentaryInProgress = false;
let pendingEvents: any[] = [];
let lastCommentaryTime = 0;

function getAblyClient() {
  if (!ablyClient) {
    const apiKey = process.env.ABLY_API_KEY;
    if (!apiKey) {
      throw new Error('ABLY_API_KEY not configured');
    }
    ablyClient = new Ably.Realtime(apiKey);
  }
  return ablyClient;
}

async function processCommentaryQueue() {
  if (pendingEvents.length === 0 || commentaryInProgress) return;
  
  const timeSinceLastCommentary = Date.now() - lastCommentaryTime;
  if (timeSinceLastCommentary < 5000) {
    // Schedule for later
    setTimeout(processCommentaryQueue, 5000 - timeSinceLastCommentary);
    return;
  }
  
  commentaryInProgress = true;
  const eventsToProcess = [...pendingEvents];
  pendingEvents = [];
  
  try {
    // TODO: In Phase 2, we'll implement OpenAI commentary generation here
    console.log('Would generate commentary for events:', eventsToProcess);
    
    // Simulate commentary generation time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    lastCommentaryTime = Date.now();
  } finally {
    commentaryInProgress = false;
    // Check if new events arrived while processing
    if (pendingEvents.length > 0) {
      setTimeout(processCommentaryQueue, 100);
    }
  }
}

async function subscribeToEvents() {
  if (isSubscribed) return;
  
  try {
    const client = getAblyClient();
    const channel = client.channels.get('football-frenzy');
    
    // Subscribe to all game events
    channel.subscribe(async (message) => {
      console.log('Received event:', message.name, message.data);
      
      // Update game state
      const event: GameEvent = {
        type: message.name as any,
        data: message.data,
      };
      
      const oldState = gameState;
      gameState = updateGameState(gameState, event);
      
      // Handle game reset
      if (event.type === 'reset') {
        console.log('Game reset - clearing state and conversation');
        pendingEvents = [];
        commentaryInProgress = false;
        lastCommentaryTime = 0;
        // TODO: In Phase 2, we'll clear OpenAI conversation here
        return;
      }
      
      // Format event for AI commentary if it's a relevant event
      const formattedEvent = formatMatchEvent(event, oldState);
      if (formattedEvent) {
        pendingEvents.push({
          formatted: formattedEvent,
          raw: event,
          timestamp: Date.now(),
        });
        
        // Trigger commentary generation if conditions are met
        if (!commentaryInProgress && Date.now() - lastCommentaryTime >= 5000) {
          await processCommentaryQueue();
        }
      }
    });
    
    isSubscribed = true;
    console.log('Successfully subscribed to football-frenzy channel');
    
  } catch (error) {
    console.error('Error subscribing to events:', error);
    throw error;
  }
}

// Initialize subscription when module loads
if (process.env.NODE_ENV === 'development') {
  subscribeToEvents().catch(console.error);
}

export async function GET() {
  try {
    // Ensure we're subscribed
    await subscribeToEvents();
    
    return NextResponse.json({
      status: 'subscribed',
      gameState: {
        score: gameState.score,
        timeLeft: gameState.timeLeft,
        isGameActive: gameState.isGameActive,
        gameHasStarted: gameState.gameHasStarted,
        pendingCommentaryEvents: pendingEvents.length,
        commentaryInProgress,
      },
    });
  } catch (error) {
    console.error('Error in ably-events handler:', error);
    return NextResponse.json(
      { error: 'Failed to subscribe to events' },
      { status: 500 }
    );
  }
}