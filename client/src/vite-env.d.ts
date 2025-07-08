/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAIN_CHANNEL: string
  readonly VITE_COMMENTARY_CHANNEL: string
  readonly VITE_ABLY_CHANNEL_NAMESPACE?: string
  readonly VITE_API_URL: string
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}