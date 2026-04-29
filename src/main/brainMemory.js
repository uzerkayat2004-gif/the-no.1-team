// brainMemory.js — Obsidian-style persistent memory system

const fs = require('fs');
const path = require('path');
const os = require('os');

const BRAIN = path.join(os.homedir(), 'no1team', 'brain');

function readFile(relPath) {
  try { const f = path.join(BRAIN, relPath); if (fs.existsSync(f)) return fs.readFileSync(f, 'utf-8'); } catch(e) { console.error('Brain read error:', e); }
  return '';
}

function writeFile(relPath, content) {
  const full = path.join(BRAIN, relPath);
  try {
    if (fs.existsSync(full)) fs.copyFileSync(full, full + '.backup');
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf-8');
    return true;
  } catch(e) { console.error('Brain write error:', e); return false; }
}

function appendToFile(relPath, content) {
  return writeFile(relPath, readFile(relPath) + content);
}

function restoreBackup(relPath) {
  const full = path.join(BRAIN, relPath); const bk = full + '.backup';
  try { if (fs.existsSync(bk)) { fs.copyFileSync(bk, full); return true; } } catch(e) { console.error('Brain restore backup error:', e); }
  return false;
}

function extractKeyPoints(text) {
  if (!text) return '- No final answer yet';
  const bullets = text.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('•'));
  if (bullets.length > 0) return bullets.slice(0, 5).join('\n');
  return text.split(/[.!?]/).filter(Boolean).slice(0, 3).map(s => `- ${s.trim()}`).join('\n');
}

function extractMeta(content, key) {
  if (key === 'title') { const m = content.match(/^#\s+(.+)/m); return m ? m[1].trim() : null; }
  const m = content.match(new RegExp(`${key}:\\s*(.+)`, 'i'));
  return m ? m[1].trim() : null;
}

function saveSession({ sessionId, sessionName, taskType, task, finalAnswer, seniorAgent, agents, researchData, combinedDoc, brainstormTranscript, bossApproved, sendBackCount }) {
  const date = new Date().toISOString().slice(0, 10);
  const safeName = (sessionName || sessionId).replace(/[^a-z0-9-_]/gi, '-').slice(0, 40);
  const folderRel = `sessions/${safeName}`;

  const moc = `# ${sessionName || 'Session'}
Date: ${date}
Task Type: ${taskType}
Status: ${bossApproved ? '✅ Approved' : '🔄 In Progress'}
Senior Agent: ${seniorAgent}
Send-backs: ${sendBackCount || 0}
Agents: ${(agents || []).join(', ')}

## Original Task
${task}

## Links
- [[${folderRel}/research-raw]]
- [[${folderRel}/research-combined]]
- [[${folderRel}/brainstorm]]
- [[${folderRel}/final-answer]]

## Key Points
${extractKeyPoints(finalAnswer)}

## Tags
#${taskType} #session-${(sessionId || '').slice(0, 8)}
${bossApproved ? '#approved' : '#in-progress'}
`;
  writeFile(`${folderRel}/session.md`, moc);

  if (researchData && Object.keys(researchData).length > 0) {
    const raw = Object.entries(researchData).map(([id, c]) => `## ${id}\n${c}\n`).join('\n---\n\n');
    writeFile(`${folderRel}/research-raw.md`, `# Raw Research\nDate: ${date}\n\n${raw}`);
  }
  if (combinedDoc) writeFile(`${folderRel}/research-combined.md`, `# Combined Research\nDate: ${date}\n\n${combinedDoc}`);
  if (brainstormTranscript) writeFile(`${folderRel}/brainstorm.md`, `# Brainstorm Transcript\nDate: ${date}\n\n${brainstormTranscript}`);
  if (finalAnswer) writeFile(`${folderRel}/final-answer.md`, `# Final Answer\nDate: ${date}\nTask: ${task}\n\n${finalAnswer}`);

  appendToFile('memory/sessions.md',
    `\n## ${sessionName || sessionId} — ${date}\n- Task: ${task?.slice(0, 100)}\n- Type: ${taskType}\n- Senior: ${seniorAgent}\n- Status: ${bossApproved ? '✅ Approved' : '🔄 Saved'}\n- Link: [[sessions/${safeName}/session]]\n`);

  if (bossApproved && finalAnswer) updateKnowledge(taskType, task, finalAnswer);
  updateMasterIndex(sessionName || sessionId, folderRel, taskType, date);
  return folderRel;
}

function updateKnowledge(taskType, task, finalAnswer) {
  const slug = task.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(' ').slice(0, 4).join('-');
  const topicPath = `knowledge/topics/${slug}.md`;
  const date = new Date().toISOString().slice(0, 10);
  const existing = readFile(topicPath);
  if (existing) appendToFile(topicPath, `\n\n## Update — ${date}\n${finalAnswer.slice(0, 500)}\n`);
  else writeFile(topicPath, `# ${task.slice(0, 60)}\nCreated: ${date}\nTask Type: ${taskType}\n\n## Summary\n${finalAnswer.slice(0, 500)}\n`);
  appendToFile('memory/learnings.md', `\n[${date}] [${taskType}] ${task.slice(0, 80)}\n→ [[knowledge/topics/${slug}]]\n`);
}

function updateMasterIndex(sessionName, folderRel, taskType, date) {
  const existing = readFile('master-index.md');
  if (!existing.includes(folderRel)) appendToFile('master-index.md', `\n- [[${folderRel}/session|${sessionName}]] — ${taskType} — ${date}`);
}

function loadSessionContext(folderRel) {
  return { moc: readFile(`${folderRel}/session.md`), research: readFile(`${folderRel}/research-raw.md`),
    combined: readFile(`${folderRel}/research-combined.md`), brainstorm: readFile(`${folderRel}/brainstorm.md`),
    final: readFile(`${folderRel}/final-answer.md`) };
}

function buildResumeBriefing(folderRel, newTask) {
  const ctx = loadSessionContext(folderRel);
  let b = '=== RESUMING PREVIOUS SESSION ===\n\n';
  if (ctx.moc) b += `PREVIOUS SESSION OVERVIEW:\n${ctx.moc.slice(0, 400)}\n\n`;
  if (ctx.final) b += `PREVIOUS FINAL ANSWER (summary):\n${ctx.final.slice(0, 400)}\n\n`;
  if (newTask) b += `NEW TASK IN THIS SESSION:\n${newTask}\n\n`;
  b += '=== END RESUME CONTEXT ===\n\n';
  return b;
}

function loadRelevantMemory(taskType, task) {
  let memory = '';
  const learnings = readFile('memory/learnings.md');
  if (learnings) { const lines = learnings.split('\n').filter(Boolean); memory += `RECENT LEARNINGS:\n${lines.slice(-10).join('\n')}\n\n`; }
  const prefs = readFile('boss/preferences.md');
  if (prefs) memory += `BOSS PREFERENCES:\n${prefs.slice(0, 200)}\n\n`;
  const slug = task.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(' ').slice(0, 4).join('-');
  const topic = readFile(`knowledge/topics/${slug}.md`);
  if (topic) memory += `RELATED PAST KNOWLEDGE:\n${topic.slice(0, 300)}\n\n`;
  return memory;
}

function updateAgentPerformance(agentId, taskType, wasApproved, sendBackCount) {
  const date = new Date().toISOString().slice(0, 10);
  appendToFile(`agents/${agentId}.md`, `\n[${date}] ${taskType} — ${wasApproved ? '✅ Approved' : '🔄 Not approved'} — Send-backs: ${sendBackCount || 0}\n`);
}

function updateSkillPerformance(taskType, wasApproved, sendBackCount) {
  const date = new Date().toISOString().slice(0, 10);
  appendToFile('memory/skill-performance.md', `\n[${date}] ${taskType} — ${wasApproved ? '✅' : '🔄'} — Send-backs: ${sendBackCount || 0}\n`);
}

function logError(agentId, errorMessage) {
  appendToFile('memory/errors.md', `\n[${new Date().toISOString().slice(0, 16).replace('T', ' ')}] ${agentId}: ${errorMessage.slice(0, 150)}\n`);
}

function listSessions() {
  const dir = path.join(BRAIN, 'sessions');
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => {
      const mocPath = path.join(dir, d.name, 'session.md');
      const moc = fs.existsSync(mocPath) ? fs.readFileSync(mocPath, 'utf-8') : '';
      return { id: d.name, folderRel: `sessions/${d.name}`, name: extractMeta(moc, 'title') || d.name,
        taskType: extractMeta(moc, 'Task Type') || 'general', date: extractMeta(moc, 'Date') || '',
        status: extractMeta(moc, 'Status') || '', senior: extractMeta(moc, 'Senior Agent') || '' };
    }).sort((a, b) => b.date.localeCompare(a.date));
  } catch(e) { console.error('Brain list sessions error:', e); return []; }
}

function getSkillStats() {
  const content = readFile('memory/skill-performance.md');
  if (!content) return {};
  const stats = {};
  content.split('\n').filter(Boolean).forEach(line => {
    const m = line.match(/\[.+\] (\w+) — (✅|🔄) — Send-backs: (\d+)/);
    if (!m) return;
    const [, tt, status, sb] = m;
    if (!stats[tt]) stats[tt] = { total: 0, approved: 0, sendBacks: 0 };
    stats[tt].total++;
    if (status === '✅') stats[tt].approved++;
    stats[tt].sendBacks += parseInt(sb);
  });
  return stats;
}

module.exports = { saveSession, loadSessionContext, buildResumeBriefing, loadRelevantMemory, updateAgentPerformance, updateSkillPerformance, logError, listSessions, getSkillStats, readFile, writeFile, restoreBackup, extractMeta };
