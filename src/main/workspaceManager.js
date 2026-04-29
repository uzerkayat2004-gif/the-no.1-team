// workspaceManager.js — Manages workspace folders per session

const fs = require('fs');
const path = require('path');
const os = require('os');
const { dialog, shell } = require('electron');

const DEFAULT_BASE = path.join(os.homedir(), 'no1team', 'workspace');

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
  if (!fs.existsSync(workDir)) return { valid: false, reason: 'Folder not found' };
  return { valid: true };
}

function listWorkspaceFiles(workDir) {
  if (!fs.existsSync(workDir)) return [];
  try { return walkDir(workDir, workDir); } catch(e) { return []; }
}

function walkDir(dir, base) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  entries.forEach(e => {
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full);
    if (e.isDirectory()) { files.push({ name: e.name, path: rel, type: 'folder' }); files.push(...walkDir(full, base)); }
    else files.push({ name: e.name, path: rel, type: 'file', size: fs.statSync(full).size });
  });
  return files;
}

function openInExplorer(workDir) {
  if (fs.existsSync(workDir)) shell.openPath(workDir);
}

module.exports = { createSessionWorkspace, chooseWorkspaceFolder, validateWorkspace, listWorkspaceFiles, openInExplorer };
