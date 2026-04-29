# Project Context: No. 1 Team (Electron Multi-Agent App)

**Hello Claude!** If you are reading this, the user has asked you to help with the "No. 1 Team" project. Please read this summary to instantly understand the architecture, recent changes, and your environment.

## 📍 Project Location & Stack
- **Path:** `C:\Users\Asus\.gemini\antigravity\scratch\World's Number One Team`
- **Framework:** Electron + React + Vite (managed via `electron-vite`)
- **Package Manager:** `npm` (Run the app locally using `npm run dev`)
- **Main Entry:** `src/main/main.js`
- **Preload Script:** `src/preload/preload.js`
- **Renderer Entry:** `src/renderer/src/App.jsx`

## 🎯 What is this app?
"No. 1 Team" is a centralized desktop orchestration application designed to manage multiple autonomous AI agents simultaneously. Instead of running multiple separate CLI windows, the user runs this single Electron app to launch, monitor, and interact with various AI tools (like Claude Code, Codex, Gemini CLI, and Antigravity) in dedicated tabs.

## 🛠️ The Recent Major Feature: Embedded PTY Terminals
We just finished implementing a robust, interactive embedded terminal system so that CLI tools (like yourself!) can run directly inside the React UI without crashing or hiding their interactive interfaces.

### How it works (The Architecture):
1. **Backend (`node-pty`):** In `main.js`, we use `node-pty` compiled against the local Electron ABI to create a native Windows ConPTY. 
2. **The "Shell-First" Launch:** To ensure system `PATH` variables are loaded correctly, we do not spawn CLI commands directly. Instead:
   - `main.js` spawns `powershell.exe`.
   - The React app waits 2 seconds, then sends the command (e.g., `claude\r`) via IPC to start the tool.
   - The React app waits 3 seconds, then automatically sends a "Join Team" prompt (`Please read the skill file at ~/no1team/brain/skills/how_to_join_team.md...`).
3. **The Bridge (`preload.js`):** A flat IPC API is exposed to React: `window.teamAPI.ptyCreate`, `ptyWrite`, `ptyResize`, `ptyKill`, `ptyStatus`, `onPtyData`, and `onPtyExit`.
4. **Frontend (`xterm.js`):** In `AgentTerminal.jsx`, we use `@xterm/xterm` and `xterm-addon-fit` to render the terminal. We recently moved to **static imports** for xterm because dynamic imports were causing `SyntaxError` crashes in Vite.

## ✅ Current State & Fixed Bugs
- The "blank black screen" terminal bug has been completely fixed by updating the React `xterm` implementation.
- `node-pty` has been added to `build.asarUnpack` and `externalizeDepsPlugin` so Vite does not try to bundle the C++ binary.
- Added a `ptyStatus` check before launch. If `node-pty` fails, a red error banner appears in the UI instead of failing silently.

## 🚀 How you can help
The user has summoned you to help refine the app, fix minor remaining issues, or extend its capabilities. 
- You are free to edit files in `src/renderer/src/` (React UI) and `src/main/main.js` (Electron Backend). 
- **Important:** If you ever need to touch the `node-pty` package, remember that it requires native C++ compilation via `npx electron-rebuild -f -w node-pty`.
- Keep the aesthetic sleek, dark-themed, and premium!
