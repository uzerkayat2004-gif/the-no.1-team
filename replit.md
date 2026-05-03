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

## Design System (v5 — Dual Theme)

All design tokens live in `src/renderer/src/styles/theme.css`.

### Themes
Two complete themes, toggled via the ☀/🌙 button in the sidebar footer. Preference saved to `localStorage` key `no1team_theme`.

**Dark (default) — pure black + warm orange**
- Surfaces: `--surface-0` (#080808) → `--surface-4` (#2A2A2A) — true black
- Accent: `--accent` (#F97316 orange), `--accent-hover` (#FB923C)
- Text: `--text-1` (#FAFAFA), `--text-2` (#A3A3A3), `--text-3` (#525252)
- Applied via `:root` (default when no `data-theme` attribute present)

**Light — warm cream/ivory + deep orange**
- Surfaces: `--surface-0` (#FBF5EC cream) → `--surface-4` (#D8C09E tan)
- Accent: `--accent` (#C44F00 deep orange), `--accent-hover` (#D45800)
- Text: `--text-1` (#1A0800 rich brown), `--text-2` (#6B3E1E), `--text-3` (#A0724A)
- Applied via `[data-theme="light"]` override block

### CSS Variable Architecture
All glassmorphism backgrounds use variables (not hardcoded rgba), so they adapt automatically:
- `--glass-bar`: translucent surface for agent bar / title bar
- `--glass-heavy`: messaging bar / modals
- `--glass-menu`: slash menu / context menu / dropdowns
- `--glass-input`: input wrapper background
- `--grid-line`: 40px crosshatch grid line color (adapts per theme)
- `--glow-a/b/c`: welcome screen ambient glow colors

### Agent Colors (dark)
claude #FB923C · codex #A78BFA · gemini #60A5FA · aider #4ADE80 · opencode #F472B6 · boss #FDE047

### Agent Colors (light)
claude #C44F00 · codex #6D28D9 · gemini #1D4ED8 · aider #15803D · opencode #BE185D · boss #B45309

### Theme Toggle
- State: `const [theme, setTheme] = useState(...)` in App.jsx
- Effect: `document.documentElement.setAttribute('data-theme', theme)` + localStorage save
- Button: `.theme-toggle-btn` in `.sidebar-bottom-row` (shows ☀ in dark, 🌙 in light)

### Key Animations
- `@keyframes auraRing` — expanding ring (globe aura)
- `@keyframes gradientShift` — background sweep (globe sphere)
- `@keyframes shimmer` — left-to-right shimmer (New Session button)
- `@keyframes pulse` — opacity fade (running agent dot)
- `@keyframes typingBounce` — bounce dots (typing indicator)
- `@keyframes msgIn` — message entry slide-up
- `@keyframes luxuryGlow` — ambient breathe (welcome/onboarding screens)
- `@keyframes earthSpin` — continent scroll (WorldGlobe)
- `@keyframes worldOrbit1/2` — orbital ring spin (WorldGlobe)

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
