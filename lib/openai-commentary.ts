import OpenAI from 'openai';
import { formatPlayerDataForPrompt } from './player-data-loader';
import fs from 'fs/promises';
import path from 'path';

let openai: OpenAI | null = null;
let conversationHistory: OpenAI.Chat.ChatCompletionMessageParam[] = [];
let isInitialized = false;

export function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPEN_AI_API_KEY;
    if (!apiKey) {
      throw new Error('OPEN_AI_API_KEY not configured. Please ensure it is set in your .env.local file');
    }
    openai = new OpenAI({
      apiKey: apiKey,
    });
  }
  return openai;
}

export async function initializeCommentarySession() {
  if (isInitialized) {
    console.log('Commentary session already initialized');
    return;
  }

  try {
    // Load system prompt - try multiple approaches for different environments
    let systemPrompt = '';
    const possiblePaths = [
      path.join(process.cwd(), 'prompts', 'commentary-system.md'),
      path.join(process.cwd(), '..', 'prompts', 'commentary-system.md'),
    ];
    
    for (const promptPath of possiblePaths) {
      try {
        systemPrompt = await fs.readFile(promptPath, 'utf-8');
        break;
      } catch (err) {
        // Continue to next path
      }
    }
    
    if (!systemPrompt) {
      throw new Error('Could not load commentary system prompt from any path');
    }
    
    // Load player data
    const playerDataPrompt = await formatPlayerDataForPrompt();
    
    // Initialize conversation with system prompt and player data
    conversationHistory = [
      {
        role: 'system',
        content: systemPrompt + playerDataPrompt
      }
    ];
    
    isInitialized = true;
    console.log('Commentary session initialized with player data');
    
  } catch (error) {
    console.error('Error initializing commentary session:', error);
    throw error;
  }
}

interface CommentaryEvent {
  formatted: string;
  raw: any;
  timestamp: number;
}

let errorCount = 0;
const MAX_ERRORS_BEFORE_RESET = 3;

export async function generateCommentary(events: CommentaryEvent[]): Promise<AsyncIterable<string>> {
  if (!isInitialized) {
    await initializeCommentarySession();
  }

  const client = getOpenAIClient();
  
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
  
  // Add user message to conversation
  conversationHistory.push({
    role: 'user',
    content: eventMessage
  });
  
  try {
    // Create streaming completion
    const stream = await client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: conversationHistory,
      stream: true,
      temperature: 0.8,
      max_tokens: 500,
    });
    
    // Create an async generator to yield chunks
    async function* streamGenerator() {
      let fullResponse = '';
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          yield content;
        }
      }
      
      // Add assistant's response to conversation history
      if (fullResponse) {
        conversationHistory.push({
          role: 'assistant',
          content: fullResponse
        });
        
        // Keep conversation history manageable (last 20 messages)
        if (conversationHistory.length > 21) {
          conversationHistory = [
            conversationHistory[0], // Keep system message
            ...conversationHistory.slice(-20)
          ];
        }
      }
    }
    
    // Reset error count on success
    errorCount = 0;
    return streamGenerator();
    
  } catch (error) {
    console.error('Error generating commentary:', error);
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
  conversationHistory = [];
  isInitialized = false;
  console.log('Commentary session reset');
}