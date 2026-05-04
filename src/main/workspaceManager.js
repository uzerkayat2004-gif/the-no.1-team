// workspaceManager.js — Manages workspace folders per session

const fs = require('fs');
const path = require('path');
const os = require('os');
const { dialog, shell } = require('electron');

const DEFAULT_BASE = path.join(os.homedir(), 'no1team', 'workspace');
const MAX_WORKSPACE_DEPTH = 6;
const MAX_WORKSPACE_ENTRIES = 1000;
const SKIPPED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'out', '.next', '.vite']);

function createSessionWorkspace(sessionId, sessionName) {
  const safeName = (sessionName || sessionId).replace(/[^a-z0-9-_]/gi, '-').slice(0, 40).toLowerCase();
  const workDir = path.join(DEFAULT_BASE, safeName);
  const subs = ['research', 'brainstorm', 'output', 'code', 'tests', 'docs'];
  fs.mkdirSync(workDir, { recursive: true });
  subs.forEach(s => fs.mkdirSync(path.join(workDir, s), { recursive: true }));
  return workDir;
}

async function chooseWorkspaceFolder(browserWindow) {
  const result = await dialog.showOpenDialog(browserWindow, {
    properties: ['openDirectory', 'createDirectory'], title: 'Choose Workspace Folder',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
}

function validateWorkspace(workDir) {
  if (!workDir) return { valid: false, reason: 'No workspace set' };
  try {
    const stat = fs.statSync(workDir);
    if (!stat.isDirectory()) return { valid: false, reason: 'Workspace is not a folder' };
    const resolved = path.resolve(workDir);
    const defaultBase = path.resolve(DEFAULT_BASE);
    const relative = path.relative(defaultBase, resolved);
    const outsideDefaultBase = relative.startsWith('..') || path.isAbsolute(relative);
    return { valid: true, outsideDefaultBase };
  } catch {
    return { valid: false, reason: 'Folder not found' };
  }
}

function listWorkspaceFiles(workDir) {
  const validation = validateWorkspace(workDir);
  if (!validation.valid) return [];
  const state = { count: 0, truncated: false };
  try { return walkDir(path.resolve(workDir), path.resolve(workDir), 0, state); } catch(e) { return []; }
}

function walkDir(dir, base, depth, state) {
  if (state.count >= MAX_WORKSPACE_ENTRIES || depth > MAX_WORKSPACE_DEPTH) {
    state.truncated = true;
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    if (state.count >= MAX_WORKSPACE_ENTRIES) break;
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory() && SKIPPED_DIRS.has(e.name)) continue;

    const full = path.join(dir, e.name);
    const rel = path.relative(base, full);
    state.count++;

    if (e.isDirectory()) {
      files.push({ name: e.name, path: rel, type: 'folder' });
      files.push(...walkDir(full, base, depth + 1, state));
    } else if (e.isFile()) {
      files.push({ name: e.name, path: rel, type: 'file', size: fs.statSync(full).size });
    }
  }
  return files;
}

function openInExplorer(workDir) {
  if (validateWorkspace(workDir).valid) shell.openPath(workDir);
}

module.exports = { createSessionWorkspace, chooseWorkspaceFolder, validateWorkspace, listWorkspaceFiles, openInExplorer, DEFAULT_BASE, MAX_WORKSPACE_DEPTH, MAX_WORKSPACE_ENTRIES };
