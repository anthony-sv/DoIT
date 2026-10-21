// Imported before @excalidraw/excalidraw so the path is set when it loads:
// fonts come from this app (copied by vite.config.ts), not from esm.sh.
declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[]
  }
}

window.EXCALIDRAW_ASSET_PATH = '/excalidraw/'

export {}
