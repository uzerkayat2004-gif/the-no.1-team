// sessionContext.js
// Manages session state passed to every agent spawn

const sessions = {};

function createSession(sessionId, data = {}) {
  sessions[sessionId] = {
    sessionId,
    task:          data.task         || '',
    taskType:      data.taskType     || 'general',
    depth:         data.depth        || 2,
    seniorAgent:   data.seniorAgent  || null,
    activeAgents:  data.activeAgents || [],
    workDir:       data.workDir      || null,
    mode:          data.mode         || 'manual',  // 'auto' or 'manual'
    phase:         data.phase        || 'phase-0-task-created',
    decisions:     data.decisions    || [],
    researchPolicy: data.researchPolicy || null,
    researchValidation: data.researchValidation || {},
    providerCapabilities: data.providerCapabilities || {},
    executionModes: data.executionModes || {},
    history:       data.history      || [],
    round:         data.round        || 0,
    createdAt:     new Date().toISOString(),
  };
  return sessions[sessionId];
}

function getSession(sessionId) {
  return sessions[sessionId] || null;
}

function updateSession(sessionId, updates) {
  if (!sessions[sessionId]) return null;
  sessions[sessionId] = { ...sessions[sessionId], ...updates };
  return sessions[sessionId];
}

function addToHistory(sessionId, entry) {
  if (!sessions[sessionId]) return;
  sessions[sessionId].history.push({
    ...entry,
    timestamp: new Date().toISOString(),
  });
}

function clearSession(sessionId) {
  delete sessions[sessionId];
}

module.exports = { createSession, getSession, updateSession, addToHistory, clearSession };
