// sessionActions.js — Rename, pin, archive, duplicate, delete sessions

const fs = require('fs');
const path = require('path');
const os = require('os');

const SESSIONS_DIR = path.join(os.homedir(), 'no1team', 'brain', 'sessions');

function getSafeSessionPath(folderName, ...parts) {
  const fullPath = path.resolve(SESSIONS_DIR, folderName || '', ...parts);
  const relative = path.relative(SESSIONS_DIR, fullPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Access denied: Path traversal detected');
  }
  return fullPath;
}

function renameSession(folderName, newName) {
  try {
    const p = getSafeSessionPath(folderName, 'session.md');
    if (!fs.existsSync(p)) return false;
    let c = fs.readFileSync(p, 'utf-8');
    c = c.replace(/^# .+/m, `# ${newName}`);
    fs.writeFileSync(p, c, 'utf-8'); return true;
  } catch (e) { console.error('Rename failed:', e); return false; }
}

function pinSession(folderName, pinned) {
  try {
    const p = getSafeSessionPath(folderName, 'session.md');
    if (!fs.existsSync(p)) return false;
    let c = fs.readFileSync(p, 'utf-8');
    if (pinned) { if (!c.includes('#pinned')) c += '\n#pinned'; }
    else c = c.replace('\n#pinned', '');
    fs.writeFileSync(p, c, 'utf-8'); return true;
  } catch (e) { console.error('Pin failed:', e); return false; }
}

function archiveSession(folderName) {
  try {
    const p = getSafeSessionPath(folderName, 'session.md');
    if (!fs.existsSync(p)) return false;
    let c = fs.readFileSync(p, 'utf-8');
    c = c.replace(/Status: .+/m, 'Status: 📦 Archived');
    fs.writeFileSync(p, c, 'utf-8'); return true;
  } catch (e) { console.error('Archive failed:', e); return false; }
}

function deleteSession(folderName) {
  try {
    const d = getSafeSessionPath(folderName);
    if (!fs.existsSync(d)) return false;
    fs.rmSync(d, { recursive: true, force: true }); return true;
  } catch (e) { console.error('Delete failed:', e); return false; }
}

function duplicateSession(folderName, newName) {
  try {
    const src = getSafeSessionPath(folderName);
    const safeName = (newName || `${folderName}-copy`).replace(/[^a-z0-9-_]/gi, '-').slice(0, 40).toLowerCase();
    const dest = getSafeSessionPath(safeName);
    if (!fs.existsSync(src)) return false;
    fs.cpSync(src, dest, { recursive: true });
    const moc = path.join(dest, 'session.md');
    if (fs.existsSync(moc)) {
      let c = fs.readFileSync(moc, 'utf-8');
      c = c.replace(/^# .+/m, `# ${newName || 'Copy of Session'}`);
      c = c.replace(/Status: .+/m, 'Status: 💾 Saved Draft');
      fs.writeFileSync(moc, c, 'utf-8');
    }
    return safeName;
  } catch (e) { console.error('Duplicate failed:', e); return false; }
}

module.exports = { renameSession, pinSession, archiveSession, deleteSession, duplicateSession, getSafeSessionPath };
