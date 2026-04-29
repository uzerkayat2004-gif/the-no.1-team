// exportManager.js — Exports session data in multiple formats

const fs = require('fs');
const path = require('path');
const os = require('os');
const { dialog } = require('electron');
const brainMemory = require('./brainMemory');

function exportMarkdown(d) {
  return `# ${d.sessionName || 'Session Export'}\n**Date:** ${d.date || new Date().toISOString().slice(0, 10)}\n**Task Type:** ${d.taskType}\n\n## Original Task\n${d.task}\n\n## Final Answer\n${d.finalAnswer || 'No final answer yet.'}\n`;
}

function exportFullReport(d, folderRel) {
  const ctx = folderRel ? brainMemory.loadSessionContext(folderRel) : {};
  return `# Full Session Report — ${d.sessionName || 'Session'}
**Date:** ${d.date || new Date().toISOString().slice(0, 10)}
**Task Type:** ${d.taskType}
**Senior Agent:** ${d.seniorAgent || 'N/A'}
**Agents:** ${(d.agents || []).join(', ')}

---

## Original Task
${d.task}

---

## Raw Research (Per Agent)
${ctx.research || 'No research data.'}

---

## Combined Research Document
${ctx.combined || 'No combined document.'}

---

## Brainstorm Transcript
${ctx.brainstorm || 'No brainstorm data.'}

---

## Final Approved Answer
${d.finalAnswer || ctx.final || 'No final answer.'}

---
*Exported from No. 1 Team*
`;
}

function exportPlainText(d) {
  return `${d.sessionName || 'Session Export'}\n${d.date || new Date().toISOString().slice(0, 10)}\n\nTASK:\n${d.task}\n\nFINAL ANSWER:\n${d.finalAnswer || 'No final answer yet.'}\n`;
}

async function saveExport(content, defaultName, extension, browserWindow) {
  const { filePath } = await dialog.showSaveDialog(browserWindow, {
    defaultPath: path.join(os.homedir(), `${defaultName}.${extension}`),
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }, { name: 'All Files', extensions: ['*'] }],
  });
  if (!filePath) return { success: false, cancelled: true };
  try { fs.writeFileSync(filePath, content, 'utf-8'); return { success: true, filePath }; }
  catch(e) { return { success: false, error: e.message }; }
}

async function exportSession({ format, sessionData, folderRel, browserWindow }) {
  const safeName = (sessionData.sessionName || 'session').replace(/[^a-z0-9]/gi, '-').slice(0, 30);
  let content, ext;
  switch(format) {
    case 'markdown':    content = exportMarkdown(sessionData); ext = 'md'; break;
    case 'full-report': content = exportFullReport(sessionData, folderRel); ext = 'md'; break;
    case 'plain':       content = exportPlainText(sessionData); ext = 'txt'; break;
    default: return { success: false, error: 'Unknown format' };
  }
  return saveExport(content, safeName, ext, browserWindow);
}

module.exports = { exportSession };
