# No. 1 Team

A multi-agent AI command center for orchestrating Claude Code, Codex, Gemini CLI, and other AI agents simultaneously.

## Architecture

- **Original design**: Electron desktop app (React + Vite + node-pty for PTY terminals)
- **Replit setup**: Running the React/Vite renderer as a standalone web app (Electron APIs are absent but gracefully handled via optional chaining `?.`)

## Tech Stack

- **Frontend**: React 19 + Vite
- **Styling**: Premium dark CSS design system (Space Grotesk / Inter / JetBrains Mono fonts)
- **Package manager**: npm
- **Build tool**: Vite (standalone config `vite.config.js`) / electron-vite (for original Electron builds)

## Design System

All design tokens live in `src/renderer/src/styles/theme.css`:

- **Surfaces**: `--surface-0` through `--surface-4` (5 depth levels, very dark)
- **Accent**: `--accent` (#7C6EFA), `--accent-hover`, `--accent-dim`, `--accent-border`, `--accent-glow`
- **Agent colors**: `--agent-claude`, `--agent-codex`, `--agent-gemini`, `--agent-aider`, `--agent-opencode`, `--agent-boss`
- **Text hierarchy**: `--text-1` through `--text-4`
- **Borders**: `--border-1` through `--border-3`
- **Fonts**: `--font-display` (Space Grotesk), `--font-body` (Inter), `--font-mono` (JetBrains Mono)
- **Button classes**: `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-ghost`, `.btn-accent`
- **Legacy aliases**: `--bg-input`, `--text-primary`, `--border`, etc. are mapped for backward compatibility

## Project Structure

```
src/
  main/          # Electron main process (not used in web mode)
  preload/       # Electron preload bridge (not used in web mode)
  renderer/      # React frontend (runs as web app)
    index.html
    src/
      App.jsx                   # Main app — titlebar, sidebar, views
      main.jsx                  # React entry point
      components/
        GeneralTab.jsx          # Chat interface — fully redesigned
        CheckpointMessage.jsx   # Checkpoint cards
        OnboardingFlow.jsx      # Onboarding steps 1-5
        ResearchPanel.jsx       # Research panel overlay
        SeniorAgentSelector.jsx # Senior agent picker
        BrainstormChatMode.jsx  # Brainstorm indicator
        ErrorDisplay.jsx        # Error cards
        ExportOptions.jsx       # Export after completion
      hooks/
      styles/
        theme.css               # Canonical CSS design system
brain/           # AI agent "brain" config files
public/          # Static assets
vite.config.js   # Standalone Vite config for web mode
```

## Scripts

- `npm run dev:web`   — Start Vite dev server on port 5000 (web mode)
- `npm run build:web` — Build the renderer for static deployment
- `npm run dev`       — Start in Electron mode (requires Electron)

## Workflows

- **Start application**: `npm run dev:web` → port 5000 (webview)

## Deployment

Configured as a **static** site:
- Build: `npm run build:web`
- Public dir: `dist/renderer`

## Key Notes

- `window.teamAPI` is the Electron IPC bridge — in web mode it is `undefined`, all calls use `?.` optional chaining
- Onboarding state stored in `localStorage` key `no1team_onboarded`
- Session state stored via `window.teamAPI?.session?.saveState / loadState` (no-op in web mode)
- Agent message streaming uses `window.teamAPI.onAgentChunk` / `onAgentDone` / `onAgentError`
- Pipeline events use `window.teamAPI.onPipelineEvent(eventName, handler)`
- All agent identity colors centralized in `AGENT_COLORS` object in `GeneralTab.jsx`
