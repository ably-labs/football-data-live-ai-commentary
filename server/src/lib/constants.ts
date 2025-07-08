// Game configuration constants
export const GAME_DURATION_SECONDS = 120; // 2 minutes

// Commentary timing constants
export const COMMENTARY_DEBOUNCE_DELAY = 5000; // 5 seconds
export const MIN_COMMENTARY_INTERVAL = 2000; // 2 seconds minimum between commentaries

// Channel configuration
function getChannelNamespace(): string {
  // Priority order:
  // 1. ABLY_CHANNEL_NAMESPACE env var (e.g., "production", "dev-matthew", "staging")
  // 2. NODE_ENV-based namespace
  // 3. Default development namespace
  
  if (process.env.ABLY_CHANNEL_NAMESPACE) {
    return process.env.ABLY_CHANNEL_NAMESPACE;
  }
  
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // In production, use clean namespace
  if (nodeEnv === 'production') {
    return 'production';
  }
  
  // In development without explicit namespace, use a default
  // This ensures client and server use the same namespace
  return 'dev-local';
}

const namespace = getChannelNamespace();

// All channels follow pattern: football-frenzy:{namespace}:{channel-type}
export const CHANNEL_NAMESPACE = namespace;
export const MAIN_CHANNEL = `football-frenzy:${namespace}:main`;
export const COMMENTARY_CHANNEL = `football-frenzy:${namespace}:commentary`;