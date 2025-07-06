import { NextResponse } from 'next/server';
import * as Ably from 'ably';
import { createInitialGameState, updateGameState, formatMatchEvent, type GameEvent, type GameState } from '@/lib/game-state';
import { initializeCommentarySession, generateCommentary, resetCommentarySession } from '@/lib/openai-commentary';

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
    console.log('Generating commentary for events:', eventsToProcess.map(e => e.formatted));
    
    const client = getAblyClient();
    const commentaryChannel = client.channels.get('football-frenzy:commentary');
    
    // Publish commentary start event
    await commentaryChannel.publish('start', {
      eventCount: eventsToProcess.length,
      timestamp: Date.now()
    });
    
    // Generate commentary using OpenAI with retry logic
    let retryCount = 0;
    const maxRetries = 2;
    let success = false;
    
    while (retryCount <= maxRetries && !success) {
      try {
        const commentaryStream = await generateCommentary(eventsToProcess);
        
        // Stream commentary chunks to Ably
        let chunkCount = 0;
        for await (const chunk of commentaryStream) {
          await commentaryChannel.publish('chunk', {
            text: chunk,
            timestamp: Date.now(),
            chunkIndex: chunkCount++
          });
        }
        
        success = true;
        console.log('Commentary generation completed successfully');
        
        // Publish completion event
        await commentaryChannel.publish('complete', {
          totalChunks: chunkCount,
          timestamp: Date.now()
        });
        
      } catch (streamError) {
        retryCount++;
        console.error(`Error generating commentary (attempt ${retryCount}/${maxRetries + 1}):`, streamError);
        
        if (retryCount <= maxRetries) {
          console.log('Retrying commentary generation...');
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        } else {
          // Send error event to clients
          await commentaryChannel.publish('error', {
            message: 'Failed to generate commentary after multiple attempts',
            timestamp: Date.now()
          });
          throw streamError;
        }
      }
    }
    
    lastCommentaryTime = Date.now();
  } catch (error) {
    console.error('Error in commentary pipeline:', error);
    // Re-queue events for next attempt
    pendingEvents = [...eventsToProcess, ...pendingEvents];
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
        resetCommentarySession();
        return;
      }
      
      // Initialize commentary session on kickoff
      if (event.type === 'game-status-update' && event.data.isGameActive === true && !oldState.isGameActive) {
        console.log('Game starting - initializing commentary session');
        await initializeCommentarySession();
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

// Track initialization state
let initializationPromise: Promise<void> | null = null;

// Ensure subscription is initialized
async function ensureSubscription() {
  if (!isSubscribed && !initializationPromise) {
    initializationPromise = subscribeToEvents()
      .then(() => {
        console.log('Ably subscription initialized successfully');
      })
      .catch((error) => {
        console.error('Failed to initialize Ably subscription:', error);
        initializationPromise = null; // Allow retry
        throw error;
      });
  }
  
  if (initializationPromise) {
    await initializationPromise;
  }
}

export async function GET() {
  try {
    // Ensure we're subscribed
    await ensureSubscription();
    
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