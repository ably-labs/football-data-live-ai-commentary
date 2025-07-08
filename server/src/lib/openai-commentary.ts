import OpenAI from 'openai';
import { formatPlayerDataForPrompt } from './player-data-loader.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let openai: OpenAI | null = null;
let isInitialized = false;
let systemInstructions: string = '';
let previousResponseId: string | null = null;

// Type declaration for the Responses API since it's not in the official types yet
interface ResponseEvent {
  type?: string;
  response?: {
    id?: string;
  };
  delta?: {
    content?: string;
  } | string;
  text?: string;
  content?: string;
  part?: unknown;
}

// Custom async iterable type for response stream
interface ResponseStream {
  [Symbol.asyncIterator](): AsyncIterator<ResponseEvent>;
}

interface ResponsesAPI {
  create(params: {
    model: string;
    input: string;
    instructions?: string;
    stream?: boolean;
    temperature?: number;
    store?: boolean;
    previous_response_id?: string;
  }): Promise<ResponseStream>;
}

// Type augmentation for OpenAI client with Responses API
type OpenAIWithResponses = OpenAI & {
  responses: ResponsesAPI;
};

export function getOpenAIClient(): OpenAI {
  if (!openai) {
    // Skip initialization during build phase
    if (process.env.NODE_ENV === 'production' && !process.env.OPEN_AI_API_KEY) {
      console.log('[OpenAI] Skipping initialization during build phase');
      // Return a dummy client that will be replaced at runtime
      return {} as OpenAI;
    }
    
    const apiKey = process.env.OPEN_AI_API_KEY;
    console.log('[OpenAI] Initializing client, API key exists:', !!apiKey);
    console.log('[OpenAI] API key length:', apiKey?.length || 0);
    console.log('[OpenAI] API key prefix:', apiKey?.substring(0, 10) + '...' || 'none');
    if (!apiKey) {
      throw new Error('OPEN_AI_API_KEY not configured. Please ensure it is set in your .env.local file');
    }
    openai = new OpenAI({
      apiKey: apiKey,
    });
    console.log('[OpenAI] Client initialized successfully');
  }
  return openai;
}

export async function initializeCommentarySession() {
  if (isInitialized) {
    console.log('Commentary session already initialized');
    return;
  }

  try {
    // Load system prompt
    let systemPrompt = '';
    const possiblePaths = [
      path.join(__dirname, '../../../../prompts', 'commentary-system.md'),
      path.join(process.cwd(), 'prompts', 'commentary-system.md'),
    ];
    
    for (const promptPath of possiblePaths) {
      try {
        systemPrompt = await fs.readFile(promptPath, 'utf-8');
        break;
      } catch {
        // Continue to next path
      }
    }
    
    if (!systemPrompt) {
      throw new Error('Could not load commentary system prompt from any path');
    }
    
    // Load player data
    const playerDataPrompt = await formatPlayerDataForPrompt();
    
    // Store system instructions for Responses API
    systemInstructions = systemPrompt + playerDataPrompt;
    
    isInitialized = true;
    console.log('Commentary session initialized with player data');
    
  } catch (error) {
    console.error('Error initializing commentary session:', error);
    throw error;
  }
}

interface CommentaryEvent {
  formatted: string;
  raw: unknown;
  timestamp: number;
  eventReceivedTime?: number;
}

let errorCount = 0;
const MAX_ERRORS_BEFORE_RESET = 3;

export async function generateCommentary(events: CommentaryEvent[], firstEventReceivedTime?: number): Promise<AsyncIterable<string>> {
  const commentaryStartTime = Date.now();
  console.log('[Commentary] Starting generation for', events.length, 'events at', commentaryStartTime);
  console.log('[Commentary] Events:', JSON.stringify(events, null, 2));
  
  // Log total latency from event to commentary start
  if (firstEventReceivedTime) {
    console.log(`[LATENCY-TOTAL] Event-to-commentary-start: ${commentaryStartTime - firstEventReceivedTime}ms`);
  }
  
  if (!isInitialized) {
    console.log('[Commentary] Session not initialized, initializing now...');
    await initializeCommentarySession();
  }

  const client = getOpenAIClient() as OpenAIWithResponses;
  console.log('[Commentary] OpenAI client obtained');
  
  // Format events for the AI
  let eventMessage = '';
  if (events.length === 1) {
    eventMessage = events[0].formatted;
  } else {
    eventMessage = 'Multiple events occurred:\n';
    events.forEach(event => {
      const parsed = JSON.parse(event.formatted);
      const minute = parsed.minute || 0;
      const type = parsed.type;
      const player = parsed.player || '';
      const team = parsed.team || '';
      eventMessage += `${minute}': ${player} - ${type} (${team})\n`;
    });
    eventMessage += '\nProvide commentary covering these events.';
  }
  
  console.log('[Commentary] Event message to send:', eventMessage);
  console.log('[Commentary] Previous response ID:', previousResponseId);
  
  try {
    console.log('[Commentary] Creating response stream using Responses API...');
    const requestStartTime = Date.now();
    console.log(`[LATENCY] Commentary prep time: ${requestStartTime - commentaryStartTime}ms (formatting events, history management)`);
    
    // Build request parameters for Responses API
    const requestParams = {
      model: 'gpt-4o-mini',
      input: eventMessage,
      instructions: systemInstructions, // Use full system instructions
      stream: true,
      temperature: 0.6, // Lower temperature for faster, more deterministic responses
      store: true, // Always store for conversation continuity
    };
    
    // Log the full request for debugging
    console.log('[Commentary] Full request params:', JSON.stringify(requestParams, null, 2));
    
    // Add previous response ID if available
    if (previousResponseId) {
      (requestParams as { previous_response_id?: string }).previous_response_id = previousResponseId;
      console.log('[Commentary] Using previous_response_id for conversation state');
    }
    
    console.log('[Commentary] Calling responses.create with model:', requestParams.model);
    
    // Check if responses API exists
    if (!client.responses || typeof client.responses.create !== 'function') {
      throw new Error('Responses API is not available on this OpenAI client instance');
    }
    
    console.log('[Commentary] Responses API is available, creating stream...');
    
    // Create the response stream using Responses API
    const responseStream = await client.responses.create(requestParams);
    
    const requestTime = Date.now() - requestStartTime;
    console.log('[Commentary] Stream created successfully in', requestTime, 'ms');
    
    // Create an async generator to yield chunks
    async function* streamGenerator() {
      console.log('[Commentary] Starting to process stream chunks...');
      let fullResponse = '';
      let chunkCount = 0;
      const streamStartTime = Date.now();
      let firstChunkTime = 0;
      let currentResponseId: string | null = null;
      
      try {
        for await (const event of responseStream as AsyncIterable<ResponseEvent>) {
          const chunkTime = Date.now() - streamStartTime;
          chunkCount++;
          
          // Log event type
          console.log(`[Commentary] Event #${chunkCount} type: ${event.type || 'unknown'}, keys: ${Object.keys(event).join(', ')}`);
          
          // Extract response ID from the response.created event
          if (event.type === 'response.created' && event.response?.id) {
            currentResponseId = event.response.id;
            console.log('[Commentary] Got response ID:', currentResponseId);
          }
          
          // Handle different event types to extract content
          let content = '';
          
          // Primary content extraction patterns for Responses API
          if (event.type === 'response.output_text.delta') {
            // This is the ACTUAL event type for streaming content from Responses API!
            content = typeof event.delta === 'string' ? event.delta : (event.delta?.content || '');
            console.log('[Commentary] response.output_text.delta event, delta:', content);
          } else if (event.type === 'response.output_text.done') {
            // Final text event - don't yield this as we've already streamed the deltas
            console.log('[Commentary] response.output_text.done event, text:', event.text);
            // Don't set content here to avoid duplication - continue to next event
            continue;
          } else if (event.type === 'response.content_part.done') {
            // Content part done - don't yield this as we've already streamed the deltas
            console.log('[Commentary] response.content_part.done event, part:', event.part);
            // Don't set content here to avoid duplication - continue to next event
            continue;
          } else if (event.type === 'response.done') {
            // Response completed
            console.log('[Commentary] Response completed');
            continue;
          } else if (event.type === 'response.output_item.added') {
            // Skip this event - it doesn't contain streaming content
            console.log('[Commentary] Output item added event - skipping');
            continue;
          }
          
          // For any other event types, skip them to avoid duplication
          if (event.type !== 'response.output_text.delta') {
            console.log('[Commentary] Skipping unknown event type:', event.type);
            continue;
          }
          
          if (content) {
            if (!firstChunkTime) {
              firstChunkTime = chunkTime;
              const totalLatency = firstEventReceivedTime ? 
                (requestStartTime + firstChunkTime - firstEventReceivedTime) : 0;
              console.log(`[LATENCY-FIRST-CHUNK] First chunk received at ${firstChunkTime}ms after API call`);
              
              // Calculate all latency components
              const eventToQueueLatency = firstEventReceivedTime ? (commentaryStartTime - firstEventReceivedTime) : 0;
              const queuePrepLatency = requestStartTime - commentaryStartTime;
              const apiCallLatency = requestTime;
              const streamToFirstChunkLatency = firstChunkTime;
              
              // Calculate percentages
              const eventToQueuePct = totalLatency ? Math.round((eventToQueueLatency / totalLatency) * 100) : 0;
              const queuePrepPct = totalLatency ? Math.round((queuePrepLatency / totalLatency) * 100) : 0;
              const apiCallPct = totalLatency ? Math.round((apiCallLatency / totalLatency) * 100) : 0;
              const streamPct = totalLatency ? Math.round((streamToFirstChunkLatency / totalLatency) * 100) : 0;
              
              console.log(`[LATENCY-BREAKDOWN] Total: ${totalLatency}ms
  ├─ Event to Queue: ${eventToQueueLatency}ms (${eventToQueuePct}%) - Includes commentary rate limiting
  ├─ Queue Preparation: ${queuePrepLatency}ms (${queuePrepPct}%) - Event formatting, history management
  ├─ OpenAI API Call: ${apiCallLatency}ms (${apiCallPct}%) - Request to response stream created
  └─ Stream to First Chunk: ${streamToFirstChunkLatency}ms (${streamPct}%) - Stream created to first content
  
  🎯 TOTAL EVENT TO FIRST CHUNK: ${totalLatency}ms`);
            }
            console.log('[Commentary] Chunk', chunkCount, 'at', chunkTime, 'ms - content:', JSON.stringify(content));
            fullResponse += content;
            yield content;
          }
        }
      } catch (streamError) {
        console.error('[Commentary] Error during streaming:', streamError);
        throw streamError;
      }
      
      // Store response ID for next request
      if (currentResponseId) {
        previousResponseId = currentResponseId;
        console.log('[Commentary] Stored response ID for next request:', previousResponseId);
      }
      
      const totalTime = Date.now() - streamStartTime;
      console.log('[Commentary] Stream complete. Total chunks:', chunkCount, 'in', totalTime, 'ms');
      console.log('[Commentary] Full response length:', fullResponse.length);
      console.log('[Commentary] Full response:', fullResponse);
      
      // If no content was generated, log a warning
      if (fullResponse.length === 0) {
        console.warn('[Commentary] WARNING: No content was generated by the Responses API');
      }
      
      // Final latency summary
      if (firstEventReceivedTime) {
        const totalEndToEndLatency = Date.now() - firstEventReceivedTime;
        console.log(`[LATENCY-FINAL] TOTAL END-TO-END LATENCY: ${totalEndToEndLatency}ms (from event received to commentary complete)`);
      }
    }
    
    // Reset error count on success
    errorCount = 0;
    console.log('[Commentary] Returning async generator');
    return streamGenerator();
    
  } catch (error) {
    console.error('[Commentary] Error generating commentary:', error);
    console.error('[Commentary] Error type:', error?.constructor?.name);
    console.error('[Commentary] Error message:', (error as Error)?.message);
    console.error('[Commentary] Full error object:', JSON.stringify(error, null, 2));
    
    // Log more details about API errors
    interface APIError extends Error {
      status?: number;
      response?: unknown;
    }
    const apiError = error as APIError;
    if (apiError.status) {
      console.error('[Commentary] API Error Status:', apiError.status);
    }
    if (apiError.response) {
      console.error('[Commentary] API Error Response:', apiError.response);
    }
    
    errorCount++;
    
    // If too many errors, reset the conversation
    if (errorCount >= MAX_ERRORS_BEFORE_RESET) {
      console.log('Too many errors, resetting commentary session...');
      resetCommentarySession();
      errorCount = 0;
      
      // Try to reinitialize
      try {
        await initializeCommentarySession();
      } catch (initError) {
        console.error('Failed to reinitialize commentary session:', initError);
      }
    }
    
    throw error;
  }
}

export function resetCommentarySession() {
  // Reset response ID to start a new conversation
  previousResponseId = null;
  console.log('Commentary session reset - clearing response ID for new conversation');
}