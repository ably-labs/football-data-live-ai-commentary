# Architecture Overview

This document describes the technical architecture of the Live AI Sports Commentary demo.

## System Components

### 1. Frontend (React + Vite)
- **Location**: `/client`
- **Technology**: React 18, TypeScript, Vite, TailwindCSS
- **Key Components**:
  - `game.tsx` - Main game UI and event handling
  - `ai-commentary.tsx` - Commentary display with streaming support
  - `ably-provider.tsx` - Ably SDK initialization and context

### 2. Backend (Node.js + Express)
- **Location**: `/server`
- **Technology**: Node.js, Express, TypeScript
- **Key Services**:
  - `ably-service.ts` - Server-side Ably subscription and event processing
  - `openai-commentary.ts` - OpenAI integration with streaming
  - `game-state.ts` - Game state management and event formatting

### 3. Realtime Infrastructure (Ably)
- **Channels**:
  - `football-frenzy:development:main` - Game events and state
  - `football-frenzy:development:commentary` - AI commentary stream
- **Message Types**:
  - Game events: `goal`, `foul`, `yellow-card`, `red-card`, `assist`
  - Commentary: `pending`, `start`, `chunk`, `complete`, `error`
  - System: `reset`, `time-update`, `game-status-update`

### 4. AI Processing (OpenAI)
- **Model**: GPT-4 (via Responses API)
- **Features**:
  - Streaming responses for real-time display
  - Conversation history for context
  - Custom prompts with player data

## Data Flow

1. **User Action** → Browser clicks event button
2. **Event Publishing** → Client publishes to Ably main channel
3. **Server Processing** → Server receives event via Ably subscription
4. **Event Batching** → Server batches events within 4-second window
5. **AI Generation** → OpenAI processes events with context
6. **Stream Publishing** → Server publishes chunks to commentary channel
7. **UI Update** → Client renders commentary with live cursor

## Key Design Decisions

### Commentary Deduplication
- Each commentary has a unique ID
- Chunks are indexed to prevent duplication
- History loading sorts chunks by index

### State Synchronization
- Game state maintained on server
- Timer runs server-side for consistency
- Full state published on major events

### Error Recovery
- Automatic reconnection via Ably SDK
- Commentary session reset after 3 errors
- History replay on page refresh

### Performance Optimizations
- 4-second debounce for event batching
- Streaming responses for perceived speed
- Edge routing via Ably's 635+ PoPs
- Connection state recovery within 2 minutes

## Security Considerations

- JWT tokens for Ably authentication
- Server-side API key management
- Environment variable isolation
- No client-side OpenAI calls

## Scaling Considerations

- Ably handles horizontal scaling automatically
- Server is stateless (state in Ably channels)
- OpenAI rate limits managed server-side
- Commentary batching reduces API calls