/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HOGE: string
  readonly VITE_FUGA: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}