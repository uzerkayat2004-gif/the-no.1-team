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

## Design System (v3)

All design tokens live in `src/renderer/src/styles/theme.css`:

- **Surfaces**: `--surface-0` (#07070D) through `--surface-4` (#20202E) — 5 depth levels
- **Accent**: `--accent` (#7C6EFA), `--accent-hover`, `--accent-dim`, `--accent-border`, `--accent-glow`
- **Agent colors**: `--agent-claude` (#F07830), `--agent-codex`, `--agent-gemini`, `--agent-aider`, `--agent-opencode`, `--agent-boss`
- **Text**: `--text-1` through `--text-4`
- **Borders**: `--border-1` through `--border-3`
- **Fonts**: `--font-display` (Space Grotesk), `--font-body` (Inter), `--font-mono` (JetBrains Mono)
- **Button classes**: `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-ghost`, `.btn-accent`
- **Keyboard badge**: `.kbd`
- **Globe**: `.globe-wrapper`, `.globe-sphere`, `.globe-ring` for animated sphere with aura rings
- **Code blocks**: `.code-block`, `.code-block-header`, `.code-lang`, `.code-copy-btn`
- **Legacy aliases**: `--bg-input`, `--text-primary`, `--border` etc. all mapped

### Key Animations
- `@keyframes auraRing` — expanding ring from center (used for globe aura)
- `@keyframes gradientShift` — background-position sweep (used for sphere color)
- `@keyframes shimmer` — left-to-right shimmer (used for New Session button)
- `@keyframes pulse` — opacity fade (used for running agent chip dot)
- `@keyframes typingBounce` — bounce dots (used for typing indicator)
- `@keyframes msgIn` — message entry slide-up
- `html::before` — subtle 24px dot-grid texture on all surfaces

## Project Structure

```
src/
  renderer/
    src/
      App.jsx                   # Main app — titlebar, sidebar, home/session/brain/settings/analytics views
      components/
        GeneralTab.jsx          # Chat interface — MessageContent (code-block parser+copy), GlobeWithRings
        CheckpointMessage.jsx   # Checkpoint approval cards
        OnboardingFlow.jsx      # 5-step onboarding with GlobeWithRings + StepProgress
        ResearchPanel.jsx       # Research panel overlay
        SeniorAgentSelector.jsx # Senior agent picker
        BrainstormChatMode.jsx  # Brainstorm indicator
        ErrorDisplay.jsx        # Error cards
        ExportOptions.jsx       # Export after pipeline completion
      styles/
        theme.css               # Canonical CSS design system (v3)
brain/           # AI agent brain config files
vite.config.js   # Standalone Vite config (port 5000, host 0.0.0.0)
```

## GeneralTab.jsx Key Components

- `MessageContent` — parses `` ``` `` fenced code blocks, renders `.code-block` with language label + copy button
- `GlobeWithRings` — animated sphere with 3 staggered aura rings (reused in empty state)
- `formatTime(ts)` — relative time formatter ("just now", "5s ago", "3m ago", fallback to HH:MM)
- `AGENT_COLOR_RAW` — hex values for inline glow effects on running chips

## OnboardingFlow.jsx

5-step wizard: Welcome → Providers → Proxy → Tour → Ready  
Uses `GlobeWithRings` and `StepProgress` components inline.

## Scripts

- `npm run dev:web`   — Start Vite dev server on port 5000 (web mode)
- `npm run build:web` — Build the renderer for static deployment

## Key Notes

- `window.teamAPI` is the Electron IPC bridge — undefined in web mode; all calls use `?.`
- Onboarding state in `localStorage` key `no1team_onboarded`
- Agent chip glow when running: `borderColor` and `boxShadow` set inline using `AGENT_COLOR_RAW` hex values
- Glassmorphism: titlebar, agent bar, messaging bar all use `backdrop-filter: blur`
- Mode badge: glassmorphism, `.mode-badge.auto` / `.mode-badge.manual`
- Input focus: gradient box-shadow via `--shadow-accent` + `::after` pseudo-element trick
