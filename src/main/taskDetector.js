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

  const hasKeywords = (keywords) => keywords.some(k => msg.includes(k));

  if (hasKeywords(['quick research', 'fast research', 'quick search']))
    return TASK_TYPES.quick;
  if (hasKeywords(['deep research', 'thorough research', 'full research']))
    return TASK_TYPES.deep;
  if (hasKeywords(['team code', 'teamcode', 'parallel code', 'all agents code']))
    return TASK_TYPES.teamcode;
  if (msg.includes('review') && hasKeywords(['code', 'file']))
    return TASK_TYPES.review;
  if (hasKeywords(['debug', 'fix', 'error', 'bug']))
    return TASK_TYPES.debug;
  if (msg.includes('test') && msg.includes('app'))
    return TASK_TYPES.apptest;
  if (hasKeywords(['test', 'unit test', 'write test']))
    return TASK_TYPES.test;
  if (hasKeywords(['plan', 'architect', 'design system', 'structure']))
    return TASK_TYPES.plan;
  if (hasKeywords(['document', 'readme', 'summarize file', 'convert file']))
    return TASK_TYPES.doc;
  if (hasKeywords(['brainstorm', 'chat', 'discuss', 'idea']))
    return TASK_TYPES.brainstorm;
  if (hasKeywords(['code', 'build', 'create', 'implement', 'write']))
    return TASK_TYPES.code;
  if (hasKeywords(['research', 'find', 'search', 'look up', 'what is']))
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
