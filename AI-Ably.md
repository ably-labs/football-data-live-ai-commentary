# AI-Powered Football Commentary with Ably

This application is a proof of concept demonstrating real-time AI-generated football commentary using OpenAI's GPT models and Ably's real-time messaging platform. The system generates dynamic, contextual, and humorous commentary based on live match events while leveraging historical player data.

## Architecture Overview

### System Components

1. **Client Applications (Web/Mobile)**
   - Subscribe to real-time commentary updates via Ably channels
   - Trigger match events (goals, fouls, cards, etc.)
   - Display streaming commentary as it's generated

2. **Server Application (Next.js API)**
   - Subscribes to match events via Ably
   - Uses OpenAI's conversation state management (Responses API)
   - Generates commentary using OpenAI's streaming API
   - Publishes commentary chunks to Ably for distribution

3. **Ably Channels**
   - `football-frenzy` - Match events, presence, and game state
   - `football-frenzy:commentary` - AI-generated commentary stream (server publish only)

4. **OpenAI Integration**
   - Uses GPT-4 or GPT-3.5-turbo with streaming responses
   - Leverages OpenAI's conversation state management for low latency
   - Receives all player data files at match initialization

## Technical Implementation

### 1. Server-Side Event Subscription

The server will:
- Subscribe to the `football-frenzy` channel using Ably's Node.js SDK
- Process incoming events (goals, fouls, cards, etc.)
- Build and maintain match state using shared game state logic
- Handle game resets by clearing state and conversation
- Implement commentary rate limiting and debouncing

```typescript
// Server subscribes to match events with debouncing
let commentaryInProgress = false;
let pendingEvents: MatchEvent[] = [];
let lastCommentaryTime = 0;

channel.subscribe('match-event', async (message) => {
  const event = message.data;
  updateGameState(event); // Always update state immediately
  
  // Queue event for commentary
  pendingEvents.push(event);
  
  // Debounce commentary generation
  if (!commentaryInProgress && Date.now() - lastCommentaryTime >= 5000) {
    await processCommentaryQueue();
  }
});

async function processCommentaryQueue() {
  if (pendingEvents.length === 0 || commentaryInProgress) return;
  
  commentaryInProgress = true;
  const eventsToProcess = [...pendingEvents];
  pendingEvents = [];
  
  try {
    await generateCommentary(eventsToProcess);
    lastCommentaryTime = Date.now();
  } finally {
    commentaryInProgress = false;
    // Check if new events arrived while processing
    if (pendingEvents.length > 0) {
      setTimeout(processCommentaryQueue, 5000 - (Date.now() - lastCommentaryTime));
    }
  }
}
```

### 2. OpenAI Integration

#### Initial Context Setup
When the match begins (kickoff event), the server will:
1. Load all player data markdown files from `/data` directory
2. Create an OpenAI conversation using the Responses API
3. Set system prompt and include all player data as context
4. Store the conversation session ID for the match duration

#### Commentary Generation using Responses API
For each batch of events:
1. Send all queued events to the conversation session
2. Receive streaming commentary response covering all events
3. Publish chunks to Ably as they arrive
4. Ensure no new commentary starts until current stream completes

```typescript
// Using OpenAI Responses API for state management
const session = await openai.beta.realtime.sessions.create({
  model: 'gpt-4-turbo',
  instructions: systemPrompt + playerDataContext,
});

// Process batch of events
async function generateCommentary(events: MatchEvent[]) {
  // Send all events as a single message for cohesive commentary
  const eventSummary = events.map(e => 
    `${e.minute}': ${e.player} - ${e.type} (${e.team})`
  ).join('\n');
  
  const response = await session.conversation.item.create({
    type: 'message',
    role: 'user',
    content: [{ 
      type: 'text', 
      text: `Multiple events occurred:\n${eventSummary}\n\nProvide commentary covering these events.`
    }]
  });

  // Stream response chunks to Ably
  for await (const chunk of response) {
    commentaryChannel.publish('chunk', {
      text: chunk.choices[0].delta.content,
      timestamp: Date.now()
    });
  }
}
```

### 3. Commentary Distribution

- Server publishes commentary chunks to `football-frenzy:commentary`
- Clients subscribe and display streaming updates
- Commentary appears character-by-character for engaging UX

### 4. Match Events Structure

```typescript
interface MatchEvent {
  type: 'goal' | 'yellow_card' | 'red_card' | 'foul' | 'substitution' | 'kickoff' | 'halftime' | 'fulltime';
  player?: string;
  team: 'home' | 'away';
  minute: number;
  details?: {
    assistedBy?: string;
    reason?: string;
    replacedBy?: string;
  };
}
```

## Commentary Generation Strategy

### System Prompt Structure

The system prompt (stored in `/prompts/commentary-system.md`) will:
1. Define the commentator personas (Barry Banter & Ronnie Roast)
2. Set the tone: humorous, edgy, data-driven
3. Provide rules for commentary length and style
4. Include all player data as context

### Commentary Guidelines

1. **Length**: 1-4 commentary exchanges per event (varied for naturalness)
2. **Style**: Short, punchy, comedian-like delivery
3. **Content Requirements**:
   - Reference player statistics and historical data
   - Include personality quirks and off-field references
   - Make comparisons to famous moments
   - Use player-specific catchphrases
   - Incorporate timely humor and banter

### Example Commentary Flow

```
Event: Beckham scores
Barry: "Beckham curls it in! That's goal #131, bending it better than his Netflix documentary ratings!"
Ronnie: "Speaking of bending, that keeper moved slower than Becks choosing his next tattoo design!"
```

## Implementation Steps

### Phase 1: Server Setup
1. Create server-side Ably client with API key authentication
2. Set up event subscription handler on `football-frenzy` channel
3. Extract and share game state management logic between frontend/backend
4. Implement game reset handling

### Phase 2: OpenAI Integration
1. Create commentary system prompt (without player summaries)
2. Implement player data loader to read all markdown files
3. Set up OpenAI Responses API client
4. Initialize conversation session on game start

### Phase 3: Commentary Pipeline
1. Build event-to-commentary processor
2. Implement streaming chunk publisher to commentary channel
3. Add error handling and conversation restart logic
4. Handle server restart by resetting game state

### Phase 4: Client Updates
1. Remove existing hardcoded commentary
2. Subscribe to `football-frenzy:commentary` channel
3. Implement streaming display UI with character-by-character rendering
4. Ensure event publishing uses consistent channel

## Benefits of This Approach

1. **Dynamic Content**: No two matches will have identical commentary
2. **Contextual Awareness**: Commentary builds on previous events
3. **Low Latency**: Streaming reduces time to first commentary
4. **Scalability**: Ably handles distribution to unlimited clients
5. **Rich Context**: Historical data makes commentary informative and entertaining

## Commentary Rate Limiting & Debouncing

The system implements intelligent rate limiting to ensure smooth commentary flow:

1. **Minimum 5-second gap** between commentary generations
2. **No concurrent commentary** - new events queue while commentary is streaming
3. **Event batching** - multiple events during the wait period are combined
4. **Smart debouncing** - accumulated events create richer, contextual commentary

Benefits:
- Prevents commentary overlap and confusion
- Allows commentators to react to multiple rapid events coherently
- Reduces OpenAI API calls while improving commentary quality
- Ensures complete game state changes are reflected in commentary

## Security Considerations

- OpenAI API key stored server-side only
- Commentary generation rate limited to prevent abuse
- Event validation to prevent malicious inputs
- Ably channel permissions:
  - `football-frenzy`: Clients can publish/subscribe
  - `football-frenzy:commentary`: Server publish only, clients subscribe

## Game State Management

- Shared game state logic between frontend and backend
- State includes: score, time, players, active status
- Game reset clears both local state and OpenAI conversation
- Server restart triggers full game reset for simplicity

## Future Enhancements

1. Multiple language support
2. Voice synthesis for audio commentary
3. Sentiment analysis for crowd reactions

This proof of concept demonstrates how AI can enhance live sports experiences by providing engaging, contextual commentary that adapts to the flow of the game while entertaining fans with data-driven insights and humor.