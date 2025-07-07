import { NextResponse } from 'next/server';
import * as Ably from 'ably';
import { createInitialGameState, updateGameState, formatMatchEvent, type GameEvent, type GameState } from '@/lib/game-state';
import { initializeCommentarySession, generateCommentary, resetCommentarySession, getOpenAIClient } from '@/lib/openai-commentary';
import { GAME_DURATION_SECONDS, COMMENTARY_DEBOUNCE_DELAY, MIN_COMMENTARY_INTERVAL } from '@/lib/constants';

// Pre-initialize OpenAI client to reduce first-call latency
getOpenAIClient();

// Initialize Ably client
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
  const queueProcessingStartTime = Date.now();
  console.log('[Queue] Processing commentary queue - pending events:', pendingEvents.length, 'in progress:', commentaryInProgress);
  if (pendingEvents.length === 0 || commentaryInProgress) {
    console.log('[Queue] Skipping - no events or already in progress');
    return;
  }
  
  const timeSinceLastCommentary = Date.now() - lastCommentaryTime;
  if (timeSinceLastCommentary < MIN_COMMENTARY_INTERVAL) {
    // Schedule for later
    setTimeout(processCommentaryQueue, MIN_COMMENTARY_INTERVAL - timeSinceLastCommentary);
    return;
  }
  
  commentaryInProgress = true;
  pendingSignalSent = false; // Reset pending signal flag
  const eventsToProcess = [...pendingEvents];
  pendingEvents = [];
  
  // Calculate event-to-processing latency
  const firstEventReceivedTime = Math.min(...eventsToProcess.map(e => e.eventReceivedTime || e.timestamp));
  const eventToProcessingLatency = queueProcessingStartTime - firstEventReceivedTime;
  console.log(`[LATENCY] Event-to-processing latency: ${eventToProcessingLatency}ms (from first event received to queue processing)`);
  
  try {
    console.log('[Queue] Generating commentary for events:', eventsToProcess.map(e => e.formatted));
    
    const client = getAblyClient();
    const commentaryChannel = client.channels.get('football-frenzy:commentary');
    console.log('[Queue] Got Ably client and commentary channel');
    
    // Generate unique commentary ID for this session
    const commentaryId = `commentary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('[Queue] Generated commentary ID:', commentaryId);
    
    // Publish commentary start event
    console.log('[Queue] Publishing commentary start event...');
    await commentaryChannel.publish('start', {
      commentaryId,
      eventCount: eventsToProcess.length,
      timestamp: Date.now(),
      gameTime: gameState.timeLeft
    });
    console.log('[Queue] Start event published successfully');
    
    // Generate commentary using OpenAI with retry logic
    let retryCount = 0;
    const maxRetries = 2;
    let success = false;
    
    while (retryCount <= maxRetries && !success) {
      try {
        console.log('[Queue] Attempt', retryCount + 1, 'to generate commentary...');
        const openAIStartTime = Date.now();
        const commentaryStream = await generateCommentary(eventsToProcess, firstEventReceivedTime);
        const openAIResponseTime = Date.now() - openAIStartTime;
        console.log(`[LATENCY] OpenAI response time: ${openAIResponseTime}ms (from API call to stream ready)`);
        console.log('[Queue] Commentary stream obtained');
        
        // Stream commentary chunks to Ably
        let chunkCount = 0;
        console.log('[Queue] Starting to stream chunks to Ably...');
        console.log('[Queue] Commentary stream type:', typeof commentaryStream);
        console.log('[Queue] Is async iterable:', commentaryStream && typeof commentaryStream[Symbol.asyncIterator] === 'function');
        
        try {
          const streamStartTime = Date.now();
          let isFirstChunk = true;
          for await (const chunk of commentaryStream) {
            const chunkTime = Date.now() - streamStartTime;
            console.log('[Queue] Publishing chunk', chunkCount, 'at', chunkTime, 'ms, length:', chunk.length, 'content:', JSON.stringify(chunk));
            
            if (isFirstChunk) {
              const eventToFirstChunkPublished = Date.now() - firstEventReceivedTime;
              console.log(`[LATENCY-FIRST-PUBLISH] First chunk published to Ably: ${eventToFirstChunkPublished}ms after event received`);
              isFirstChunk = false;
            }
            
            // Don't await - fire and forget for real-time streaming
            commentaryChannel.publish('chunk', {
              commentaryId,
              text: chunk,
              timestamp: Date.now(),
              chunkIndex: chunkCount++,
              gameTime: gameState.timeLeft  // Use current game time when chunk is published
            }).catch(err => {
              console.error('[Queue] Error publishing chunk:', err);
            });
          }
          const totalStreamTime = Date.now() - streamStartTime;
          console.log('[Queue] All chunks published. Total:', chunkCount, 'in', totalStreamTime, 'ms');
        } catch (iterError) {
          console.error('[Queue] Error iterating over commentary stream:', iterError);
          console.error('[Queue] Iteration error type:', iterError?.constructor?.name);
          console.error('[Queue] Iteration error message:', (iterError as any)?.message);
          throw iterError;
        }
        
        success = true;
        console.log('Commentary generation completed successfully');
        
        // Publish completion event
        console.log('[Queue] Publishing completion event...');
        await commentaryChannel.publish('complete', {
          commentaryId,
          totalChunks: chunkCount,
          timestamp: Date.now()
        });
        console.log('[Queue] Completion event published');
        
      } catch (streamError) {
        retryCount++;
        console.error(`[Queue] Error generating commentary (attempt ${retryCount}/${maxRetries + 1}):`, streamError);
        console.error('[Queue] Error type:', (streamError as any)?.constructor?.name);
        console.error('[Queue] Error stack:', (streamError as any)?.stack);
        
        // Check if it's an OpenAI API error
        if ((streamError as any)?.response) {
          console.error('[Queue] OpenAI API Response:', (streamError as any).response);
          console.error('[Queue] OpenAI Status:', (streamError as any).response?.status);
          console.error('[Queue] OpenAI Headers:', (streamError as any).response?.headers);
        }
        
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
    console.error('[Queue] Error in commentary pipeline:', error);
    console.error('[Queue] Error type:', (error as any)?.constructor?.name);
    console.error('[Queue] Error stack:', (error as any)?.stack);
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
      const eventReceivedTime = Date.now();
      console.log(`[LATENCY] Event received: ${message.name} at ${eventReceivedTime}`);
      
      // Update game state
      const event: GameEvent = {
        type: message.name as GameEvent['type'],
        data: message.data,
      };
      
      const oldState = { 
        ...gameState,
        players: gameState.players.map(p => ({ ...p, stats: { ...p.stats } }))
      }; // Create a deep copy of the old state
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
        const client = getAblyClient();
        const commentaryChannel = client.channels.get('football-frenzy:commentary');
        commentaryChannel.publish('clear', { timestamp: Date.now() });
        
        return;
      }
      
      // Initialize commentary session on kickoff and start timer
      if (event.type === 'game-status-update' && event.data.isGameActive === true && !oldState.isGameActive) {
        console.log('Game starting - initializing commentary session');
        await initializeCommentarySession();
        // Reset lastCommentaryTime to ensure kickoff commentary triggers immediately
        lastCommentaryTime = 0;
        
        // Start server-side game timer
        if (gameTimerInterval) {
          clearInterval(gameTimerInterval);
        }
        
        gameTimerInterval = setInterval(async () => {
          if (gameState.timeLeft > 0) {
            gameState.timeLeft--;
            
            // Broadcast time update every second using ephemeral message
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
                }, { ...gameState, isGameActive: true }); // Pass state where game was still active
                
                if (fulltimeEvent) {
                  const eventData = {
                    formatted: fulltimeEvent,
                    raw: { type: 'fulltime' },
                    timestamp: Date.now(),
                    eventReceivedTime: Date.now(),
                  };
                  pendingEvents.push(eventData);
                  console.log('[Timer] Added fulltime event to pending events');
                  
                  // Trigger commentary immediately for fulltime
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
      if (event.type === 'game-status-update' && event.data.isGameActive === false) {
        if (gameTimerInterval) {
          clearInterval(gameTimerInterval);
          gameTimerInterval = null;
        }
      }
      
      // Format event for AI commentary if it's a relevant event
      const formattedEvent = formatMatchEvent(event, oldState);
      console.log('[Events] Formatted event:', formattedEvent);
      if (formattedEvent) {
        const eventData = {
          formatted: formattedEvent,
          raw: event,
          timestamp: Date.now(),
          eventReceivedTime: eventReceivedTime,
        };
        pendingEvents.push(eventData);
        console.log('[Events] Added to pending events. Total pending:', pendingEvents.length);
        console.log(`[LATENCY] Event processing time: ${Date.now() - eventReceivedTime}ms`);
        
        // Immediately signal that commentary is pending - this shows the cursor
        // Only send if we haven't already sent a pending signal
        if (!pendingSignalSent && !commentaryInProgress) {
          const commentaryChannel = client.channels.get('football-frenzy:commentary');
          await commentaryChannel.publish('pending', {
            timestamp: Date.now(),
            gameTime: gameState.timeLeft
          });
          pendingSignalSent = true;
        }
        
        // Implement debouncing logic
        const timeSinceLastCommentary = Date.now() - lastCommentaryTime;
        console.log('[Events] Time since last commentary:', timeSinceLastCommentary, 'ms');
        console.log('[Events] Commentary in progress:', commentaryInProgress);
        console.log('[Events] Pending events count:', pendingEvents.length);
        
        if (!commentaryInProgress) {
          // Clear any existing debounce timer
          if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
          }
          
          // If enough time has passed since last commentary (5 seconds), trigger immediately
          // This ensures first event after a quiet period always triggers immediately
          if (timeSinceLastCommentary >= COMMENTARY_DEBOUNCE_DELAY) {
            console.log('[Events] Triggering commentary immediately - first event after', timeSinceLastCommentary, 'ms quiet period');
            processCommentaryQueue();
          } else {
            // Otherwise, batch events for up to 5 seconds
            // Calculate remaining time in the current 5-second window
            const remainingTime = COMMENTARY_DEBOUNCE_DELAY - timeSinceLastCommentary;
            console.log('[Events] Setting up debounce timer for', remainingTime, 'ms (within 5s window)');
            
            debounceTimer = setTimeout(() => {
              if (pendingEvents.length > 0 && !commentaryInProgress) {
                console.log('[Events] Debounce timer fired - processing', pendingEvents.length, 'events');
                processCommentaryQueue();
              }
              debounceTimer = null;
            }, remainingTime);
          }
        } else {
          console.log('[Events] Not triggering commentary - already in progress');
        }
      } else {
        console.log('[Events] Event not formatted for commentary');
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
  console.log('[API] GET /api/ably-events called');
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