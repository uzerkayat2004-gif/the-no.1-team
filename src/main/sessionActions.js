// sessionActions.js — Rename, pin, archive, duplicate, delete sessions

const fs = require('fs');
const path = require('path');
const os = require('os');

const SESSIONS_DIR = path.join(os.homedir(), 'no1team', 'brain', 'sessions');

function renameSession(folderName, newName) {
  const p = path.join(SESSIONS_DIR, folderName, 'session.md');
  if (!fs.existsSync(p)) return false;
  let c = fs.readFileSync(p, 'utf-8');
  c = c.replace(/^# .+/m, `# ${newName}`);
  fs.writeFileSync(p, c, 'utf-8'); return true;
}

function pinSession(folderName, pinned) {
  const p = path.join(SESSIONS_DIR, folderName, 'session.md');
  if (!fs.existsSync(p)) return false;
  let c = fs.readFileSync(p, 'utf-8');
  if (pinned) { if (!c.includes('#pinned')) c += '\n#pinned'; }
  else c = c.replace('\n#pinned', '');
  fs.writeFileSync(p, c, 'utf-8'); return true;
}

function archiveSession(folderName) {
  const p = path.join(SESSIONS_DIR, folderName, 'session.md');
  if (!fs.existsSync(p)) return false;
  let c = fs.readFileSync(p, 'utf-8');
  c = c.replace(/Status: .+/m, 'Status: 📦 Archived');
  fs.writeFileSync(p, c, 'utf-8'); return true;
}

function deleteSession(folderName) {
  const d = path.join(SESSIONS_DIR, folderName);
  if (!fs.existsSync(d)) return false;
  fs.rmSync(d, { recursive: true, force: true }); return true;
}

function duplicateSession(folderName, newName) {
  const src = path.join(SESSIONS_DIR, folderName);
  const safeName = (newName || `${folderName}-copy`).replace(/[^a-z0-9-_]/gi, '-').slice(0, 40).toLowerCase();
  const dest = path.join(SESSIONS_DIR, safeName);
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
}

module.exports = { renameSession, pinSession, archiveSession, deleteSession, duplicateSession };
