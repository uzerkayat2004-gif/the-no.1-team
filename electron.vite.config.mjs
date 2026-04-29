import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'

// Plugin to copy unbundled files to dist/main/
function copyMainFilesPlugin() {
  return {
    name: 'copy-main-files',
    closeBundle() {
      const files = ['agentRunner.js', 'proxySettings.js', 'providerProfiles.js', 'taskDetector.js', 'skillBuilder.js', 'sessionContext.js', 'pipelineManager.js', 'collaborationManager.js', 'brainMemory.js', 'brainstormChat.js', 'analyticsManager.js', 'notificationManager.js', 'exportManager.js', 'errorHandler.js', 'workspaceManager.js', 'sessionActions.js']
      files.forEach(file => {
        const src = resolve(__dirname, `src/main/${file}`)
        const dest = resolve(__dirname, `dist/main/${file}`)
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest)
          console.log(`✓ Copied ${file} to dist/main/`)
        }
      })
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyMainFilesPlugin()],
    build: {
      outDir: 'dist/main',
      rollupOptions: {
        external: ['electron', './agentRunner', './proxySettings', './providerProfiles', './taskDetector', './skillBuilder', './sessionContext', './pipelineManager', './collaborationManager', './brainMemory', './brainstormChat', './analyticsManager', './notificationManager', './exportManager', './errorHandler', './workspaceManager', './sessionActions']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload',
      rollupOptions: {
        external: ['electron']
      }
    }
  },
  renderer: {
    plugins: [react()],
    base: './',
    build: {
      outDir: 'dist/renderer'
    }
  }
})
