// taskDetector.js
// Detects task type from Boss message or slash command

const TASK_TYPES = {
  quick:       { id: 'quick',       label: 'Quick Research',  icon: '⚡' },
  research:    { id: 'research',    label: 'Mid Research',    icon: '🔍' },
  deep:        { id: 'deep',        label: 'Deep Research',   icon: '🔬' },
  code:        { id: 'code',        label: 'Coding Task',     icon: '💻' },
  teamcode:    { id: 'teamcode',    label: 'Team Coding',     icon: '👥' },
  review:      { id: 'review',      label: 'Code Review',     icon: '👁️'  },
  debug:       { id: 'debug',       label: 'Debugging',       icon: '🐛' },
  plan:        { id: 'plan',        label: 'Planning',        icon: '📐' },
  test:        { id: 'test',        label: 'Testing',         icon: '🧪' },
  apptest:     { id: 'apptest',     label: 'App Testing',     icon: '📱' },
  doc:         { id: 'doc',         label: 'Document',        icon: '📄' },
  brainstorm:  { id: 'brainstorm',  label: 'Brainstorm Chat', icon: '💬' },
  general:     { id: 'general',     label: 'General',         icon: '💬' },
};

// Detect from slash command (highest priority — exact match)
function detectFromSlash(message) {
  const match = message.match(/^\/(\w+)/);
  if (!match) return null;
  const cmd = match[1].toLowerCase();
  return TASK_TYPES[cmd] || null;
}

// Detect from keywords (fallback)
function detectFromKeywords(message) {
  const msg = message.toLowerCase();

  if (msg.includes('quick research') || msg.includes('fast research') || msg.includes('quick search'))
    return TASK_TYPES.quick;
  if (msg.includes('deep research') || msg.includes('thorough research') || msg.includes('full research'))
    return TASK_TYPES.deep;
  if (msg.includes('team code') || msg.includes('teamcode') || msg.includes('parallel code') || msg.includes('all agents code'))
    return TASK_TYPES.teamcode;
  if (msg.includes('review') && (msg.includes('code') || msg.includes('file')))
    return TASK_TYPES.review;
  if (msg.includes('debug') || msg.includes('fix') || msg.includes('error') || msg.includes('bug'))
    return TASK_TYPES.debug;
  if (msg.includes('test') && msg.includes('app'))
    return TASK_TYPES.apptest;
  if (msg.includes('test') || msg.includes('unit test') || msg.includes('write test'))
    return TASK_TYPES.test;
  if (msg.includes('plan') || msg.includes('architect') || msg.includes('design system') || msg.includes('structure'))
    return TASK_TYPES.plan;
  if (msg.includes('document') || msg.includes('readme') || msg.includes('summarize file') || msg.includes('convert file'))
    return TASK_TYPES.doc;
  if (msg.includes('brainstorm') || msg.includes('chat') || msg.includes('discuss') || msg.includes('idea'))
    return TASK_TYPES.brainstorm;
  if (msg.includes('code') || msg.includes('build') || msg.includes('create') || msg.includes('implement') || msg.includes('write'))
    return TASK_TYPES.code;
  if (msg.includes('research') || msg.includes('find') || msg.includes('search') || msg.includes('look up') || msg.includes('what is'))
    return TASK_TYPES.research;

  return TASK_TYPES.general;
}

// Main detection function
function detectTaskType(message) {
  const fromSlash = detectFromSlash(message);
  if (fromSlash) return { taskType: fromSlash, fromSlash: true };

  const fromKeywords = detectFromKeywords(message);
  return { taskType: fromKeywords, fromSlash: false };
}

// Strip slash command from message before sending to agents
function stripSlashCommand(message) {
  return message.replace(/^\/\w+\s*/, '').trim();
}

module.exports = { detectTaskType, stripSlashCommand, TASK_TYPES };
