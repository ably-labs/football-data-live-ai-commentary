import * as Ably from 'ably';
import { createInitialGameState, updateGameState, formatMatchEvent, type GameEvent, type GameState } from '../lib/game-state.js';
import { initializeCommentarySession, generateCommentary, resetCommentarySession } from '../lib/openai-commentary.js';

// Constants
const COMMENTARY_DEBOUNCE_DELAY = 4000; // 4 seconds - if events come within this window, batch them
const MIN_COMMENTARY_INTERVAL = 0; // No minimum interval - process immediately

// Use different channels for development vs production
const channelPrefix = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const MAIN_CHANNEL = process.env.MAIN_CHANNEL || `football-frenzy:${channelPrefix}:main`;
const COMMENTARY_CHANNEL = process.env.COMMENTARY_CHANNEL || `football-frenzy:${channelPrefix}:commentary`;

// Singleton Ably client - this persists across requests
let ablyClient: Ably.Realtime | null = null;
let gameState: GameState = createInitialGameState();
let isSubscribed = false;

// Commentary rate limiting and debouncing
let commentaryInProgress = false;
let pendingSignalSent = false;
let pendingEvents: Array<{
  formatted: string;
  raw: unknown;
  timestamp: number;
  eventReceivedTime?: number;
}> = [];
let lastCommentaryTime = 0;
let debounceTimer: NodeJS.Timeout | null = null;

// Game timer management
let gameTimerInterval: NodeJS.Timeout | null = null;

async function processCommentaryQueue() {
  const queueProcessingStartTime = Date.now();
  console.log('[Queue] Processing commentary queue - pending events:', pendingEvents.length, 'in progress:', commentaryInProgress);
  if (pendingEvents.length === 0 || commentaryInProgress) {
    console.log('[Queue] Skipping - no events or already in progress');
    return;
  }
  
  // Remove the MIN_COMMENTARY_INTERVAL check - process immediately
  
  commentaryInProgress = true;
  pendingSignalSent = false;
  lastCommentaryTime = Date.now(); // Set this when we START processing
  const eventsToProcess = [...pendingEvents];
  pendingEvents = [];
  
  // Calculate event-to-processing latency
  const firstEventReceivedTime = Math.min(...eventsToProcess.map(e => e.eventReceivedTime || e.timestamp));
  const eventToProcessingLatency = queueProcessingStartTime - firstEventReceivedTime;
  console.log(`[LATENCY] Event-to-processing latency: ${eventToProcessingLatency}ms`);
  
  try {
    console.log('[Queue] Generating commentary for events:', eventsToProcess.map(e => e.formatted));
    
    const commentaryChannel = ablyClient!.channels.get(COMMENTARY_CHANNEL);
    const commentaryId = `commentary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Publish commentary start event
    await commentaryChannel.publish('start', {
      commentaryId,
      eventCount: eventsToProcess.length,
      timestamp: Date.now(),
      gameTime: gameState.timeLeft
    });
    
    // Generate commentary using OpenAI
    const commentaryStream = await generateCommentary(eventsToProcess, firstEventReceivedTime);
    
    // Stream commentary chunks to Ably
    let chunkCount = 0;
    let isFirstChunk = true;
    for await (const chunk of commentaryStream) {
      if (isFirstChunk) {
        const eventToFirstChunkPublished = Date.now() - firstEventReceivedTime;
        console.log(`[LATENCY-FIRST-PUBLISH] First chunk published: ${eventToFirstChunkPublished}ms after event received`);
        isFirstChunk = false;
      }
      
      // Don't await - fire and forget for real-time streaming
      commentaryChannel.publish('chunk', {
        commentaryId,
        text: chunk,
        timestamp: Date.now(),
        chunkIndex: chunkCount++,
        gameTime: gameState.timeLeft
      }).catch(err => {
        console.error('[Queue] Error publishing chunk:', err);
      });
    }
    
    // Publish completion event
    await commentaryChannel.publish('complete', {
      commentaryId,
      totalChunks: chunkCount,
      timestamp: Date.now()
    });
    
    // Don't update lastCommentaryTime here - it's already set at the start
  } catch (error) {
    console.error('[Queue] Error in commentary pipeline:', error);
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
  if (!ablyClient || isSubscribed) return;
  
  try {
    const channel = ablyClient.channels.get(MAIN_CHANNEL);
    
    // Subscribe to all game events
    channel.subscribe(async (message) => {
      const eventReceivedTime = Date.now();
      console.log(`[Event] Received: ${message.name} at ${eventReceivedTime}`);
      
      // Update game state
      const event: GameEvent = {
        type: message.name as GameEvent['type'],
        data: message.data,
      };
      
      const oldState = { 
        ...gameState,
        players: gameState.players.map(p => ({ ...p, stats: { ...p.stats } }))
      };
      gameState = updateGameState(gameState, event);
      
      // Handle game reset
      if (event.type === 'reset') {
        console.log('Game reset - clearing state and conversation');
        pendingEvents = [];
        commentaryInProgress = false;
        pendingSignalSent = false;
        lastCommentaryTime = 0;
        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }
        if (gameTimerInterval) {
          clearInterval(gameTimerInterval);
          gameTimerInterval = null;
        }
        resetCommentarySession();
        
        // Publish a clear commentary event
        const commentaryChannel = ablyClient!.channels.get(COMMENTARY_CHANNEL);
        await commentaryChannel.publish('clear', { timestamp: Date.now() });
        
        return;
      }
      
      // Initialize commentary session on kickoff and start timer
      if (event.type === 'game-status-update' && event.data && typeof event.data === 'object' && 
          'isGameActive' in event.data && event.data.isGameActive === true && !oldState.isGameActive) {
        console.log('Game starting - initializing commentary session');
        await initializeCommentarySession();
        lastCommentaryTime = 0;
        
        // Start server-side game timer
        if (gameTimerInterval) {
          clearInterval(gameTimerInterval);
        }
        
        gameTimerInterval = setInterval(async () => {
          if (gameState.timeLeft > 0) {
            gameState.timeLeft--;
            
            // Broadcast time update every second
            await channel.publish({
              name: 'time-update',
              data: {
                timeLeft: gameState.timeLeft,
                timestamp: Date.now()
              },
              extras: {
                ref: {
                  type: 'com.ably:ephemeral'
                }
              }
            });
            
            // Check for game end
            if (gameState.timeLeft === 0) {
              const wasActive = gameState.isGameActive;
              gameState.isGameActive = false;
              clearInterval(gameTimerInterval!);
              gameTimerInterval = null;
              
              // Publish game end event
              await channel.publish('game-status-update', {
                isGameActive: false,
                timeLeft: 0
              });
              
              // Generate fulltime commentary event
              if (wasActive) {
                const fulltimeEvent = formatMatchEvent({
                  type: 'game-status-update',
                  data: { isGameActive: false, timeLeft: 0 }
                }, { ...gameState, isGameActive: true });
                
                if (fulltimeEvent) {
                  const eventData = {
                    formatted: fulltimeEvent,
                    raw: { type: 'fulltime' },
                    timestamp: Date.now(),
                    eventReceivedTime: Date.now(),
                  };
                  pendingEvents.push(eventData);
                  
                  if (!commentaryInProgress) {
                    processCommentaryQueue();
                  }
                }
              }
            }
          }
        }, 1000);
      }
      
      // Stop timer on game end
      if (event.type === 'game-status-update' && event.data && typeof event.data === 'object' && 
          'isGameActive' in event.data && event.data.isGameActive === false) {
        if (gameTimerInterval) {
          clearInterval(gameTimerInterval);
          gameTimerInterval = null;
        }
      }
      
      // Format event for AI commentary if it's a relevant event
      const formattedEvent = formatMatchEvent(event, oldState);
      if (formattedEvent) {
        const eventData = {
          formatted: formattedEvent,
          raw: event,
          timestamp: Date.now(),
          eventReceivedTime: eventReceivedTime,
        };
        pendingEvents.push(eventData);
        
        // Immediately signal that commentary is pending
        if (!pendingSignalSent && !commentaryInProgress) {
          const commentaryChannel = ablyClient!.channels.get(COMMENTARY_CHANNEL);
          await commentaryChannel.publish('pending', {
            timestamp: Date.now(),
            gameTime: gameState.timeLeft
          });
          pendingSignalSent = true;
        }
        
        // New debouncing logic: process immediately unless we're within the debounce window
        const timeSinceLastCommentary = Date.now() - lastCommentaryTime;
        
        if (!commentaryInProgress) {
          // If no recent commentary, process immediately
          if (timeSinceLastCommentary >= COMMENTARY_DEBOUNCE_DELAY) {
            // Clear any existing timer
            if (debounceTimer) {
              clearTimeout(debounceTimer);
              debounceTimer = null;
            }
            processCommentaryQueue();
          } else {
            // We're within the debounce window - batch events
            if (debounceTimer) {
              clearTimeout(debounceTimer);
            }
            // Wait until the debounce period expires
            const remainingTime = COMMENTARY_DEBOUNCE_DELAY - timeSinceLastCommentary;
            debounceTimer = setTimeout(() => {
              if (pendingEvents.length > 0 && !commentaryInProgress) {
                processCommentaryQueue();
              }
              debounceTimer = null;
            }, remainingTime);
          }
        }
      }
    });
    
    isSubscribed = true;
    console.log(`Successfully subscribed to channel: ${MAIN_CHANNEL}`);
    
  } catch (error) {
    console.error('Error subscribing to events:', error);
    throw error;
  }
}

export async function initializeAblyService() {
  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) {
    throw new Error('ABLY_API_KEY not configured');
  }
  
  console.log('[Ably] Initializing Ably Realtime client...');
  console.log('[Ably] Environment:', process.env.NODE_ENV);
  console.log('[Ably] Node.js version:', process.version);
  console.log('[Ably] Using channels:', { MAIN_CHANNEL, COMMENTARY_CHANNEL });
  
  try {
    // Create Ably client with proper configuration for Node.js
    ablyClient = new Ably.Realtime({
      key: apiKey,
      // Ably v2 doesn't support log option in constructor
    });
    
    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      ablyClient!.connection.once('connected', () => {
        console.log('[Ably] Connected successfully');
        resolve();
      });
      
      ablyClient!.connection.once('failed', (stateChange) => {
        console.error('[Ably] Connection failed:', stateChange);
        reject(new Error('Failed to connect to Ably'));
      });
    });
    
    // Subscribe to events
    await subscribeToEvents();
    
  } catch (error) {
    console.error('[Ably] Error initializing:', error);
    throw error;
  }
}

export function getGameState(): GameState {
  return gameState;
}