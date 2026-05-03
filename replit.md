# World's Number One Team

A multi-agent AI command center for orchestrating Claude Code, Codex, Gemini CLI, and other AI agents simultaneously.

## Architecture

- **Original design**: Electron desktop app (React + Vite + node-pty for PTY terminals)
- **Replit setup**: Running the React/Vite renderer as a standalone web app (Electron APIs are absent but gracefully handled via optional chaining `?.`)

## Tech Stack

- **Frontend**: React 19 + Vite
- **Styling**: Custom dark CSS theme (Space Grotesk / Inter / JetBrains Mono fonts)
- **Package manager**: npm
- **Build tool**: Vite (standalone config) / electron-vite (original Electron builds)

## Project Structure

```
src/
  main/          # Electron main process (not used in web mode)
  preload/       # Electron preload bridge (not used in web mode)
  renderer/      # React frontend (runs as web app)
    index.html
    src/
      App.jsx         # Main app component
      main.jsx        # React entry point
      components/     # UI components
      hooks/          # Custom React hooks
      styles/         # CSS theme
brain/           # AI agent "brain" configuration files
public/          # Static assets
vite.config.js   # Standalone Vite config for web mode
```

## Scripts

- `npm run dev:web` — Start the Vite dev server on port 5000 (web mode)
- `npm run build:web` — Build the renderer for static deployment
- `npm run dev` — Start in Electron mode (requires Electron environment)

## Workflows

- **Start application**: `npm run dev:web` → port 5000 (webview)

## Deployment

Configured as a **static** site:
- Build: `npm run build:web`
- Public dir: `dist/renderer`

## Notes

- `window.teamAPI` is the Electron IPC bridge — in web mode it is `undefined`, and all calls use optional chaining so the UI loads without errors
- The app shows an onboarding flow on first visit (stored in localStorage)
