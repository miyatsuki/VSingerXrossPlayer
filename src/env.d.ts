/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HOGE: string
  readonly VITE_FUGA: string
  readonly VITE_GOOGLE_OAUTH_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
