# Football Data Live AI Commentary

A real-time football match simulation with AI-powered commentary using Ably and OpenAI.

## Features

- Live 5-a-side football match simulation
- Real-time multiplayer experience using Ably
- AI-generated commentary powered by OpenAI GPT-4
- Historical player data for contextual commentary
- Streaming commentary with character-by-character display

## Prerequisites

- Node.js 18+ installed
- An [Ably account](https://ably.com) with an API key
- An [OpenAI account](https://platform.openai.com) with an API key

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd football-data-live-ai-commentary
```

### 2. Install dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Set up environment variables

Copy the example environment file to create your local configuration:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API keys:

```env
# Ably API Key for real-time communication
ABLY_API_KEY=your-ably-api-key

# OpenAI API Key for AI commentary generation
OPEN_AI_API_KEY=your-openai-api-key
```

**Important**: Next.js only loads environment variables from `.env.local` (not `.env`). The `.env.local` file is already in `.gitignore` and should never be committed to version control.

### 4. Run the development server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## How It Works

1. **Game Events**: Players trigger events (goals, fouls, cards) through the web interface
2. **Server Subscription**: A server-side Ably client subscribes to all game events
3. **AI Commentary**: Events are sent to OpenAI with rich player context from the `/data` folder
4. **Streaming Response**: AI-generated commentary is streamed back character-by-character
5. **Real-time Distribution**: Commentary is published via Ably to all connected clients

## Architecture

- **Frontend**: Next.js with React and TypeScript
- **Real-time Communication**: Ably Pub/Sub
- **AI Commentary**: OpenAI GPT-4 with streaming responses
- **Authentication**: JWT tokens generated server-side for Ably
- **State Management**: Shared game state logic between client and server

## Player Data

The `/data` directory contains detailed markdown files for each player, including:
- Career statistics
- Playing style
- Historical achievements
- Trivia and controversies
- Ready-made commentary lines

This data provides rich context for the AI to generate informed, entertaining commentary.

## Development

- The server automatically subscribes to game events on startup
- Commentary generation is rate-limited to minimum 5-second gaps
- Multiple rapid events are batched for coherent commentary
- Game reset clears both game state and AI conversation history

## Troubleshooting

### "OPEN_AI_API_KEY not configured" error
- Ensure you've copied `.env.example` to `.env.local`
- Verify your OpenAI API key is correctly set in `.env.local`
- Restart the development server after changing environment variables

### Ably authentication errors
- Check that your Ably API key is correctly set in `.env.local`
- Ensure the key has the necessary permissions for publishing and subscribing

## Learn More

- [Ably Documentation](https://ably.com/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)