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

  if (['quick research', 'fast research', 'quick search'].some(kw => msg.includes(kw)))
    return TASK_TYPES.quick;
  if (['deep research', 'thorough research', 'full research'].some(kw => msg.includes(kw)))
    return TASK_TYPES.deep;
  if (['team code', 'teamcode', 'parallel code', 'all agents code'].some(kw => msg.includes(kw)))
    return TASK_TYPES.teamcode;
  if (msg.includes('review') && ['code', 'file'].some(kw => msg.includes(kw)))
    return TASK_TYPES.review;
  if (['debug', 'fix', 'error', 'bug'].some(kw => msg.includes(kw)))
    return TASK_TYPES.debug;
  if (msg.includes('test') && msg.includes('app'))
    return TASK_TYPES.apptest;
  if (['test', 'unit test', 'write test'].some(kw => msg.includes(kw)))
    return TASK_TYPES.test;
  if (['plan', 'architect', 'design system', 'structure'].some(kw => msg.includes(kw)))
    return TASK_TYPES.plan;
  if (['document', 'readme', 'summarize file', 'convert file'].some(kw => msg.includes(kw)))
    return TASK_TYPES.doc;
  if (['brainstorm', 'chat', 'discuss', 'idea'].some(kw => msg.includes(kw)))
    return TASK_TYPES.brainstorm;
  if (['code', 'build', 'create', 'implement', 'write'].some(kw => msg.includes(kw)))
    return TASK_TYPES.code;
  if (['research', 'find', 'search', 'look up', 'what is'].some(kw => msg.includes(kw)))
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
