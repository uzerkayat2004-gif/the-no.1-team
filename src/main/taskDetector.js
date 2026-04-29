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

  const rules = [
    { type: TASK_TYPES.quick, keywords: ['quick research', 'fast research', 'quick search'] },
    { type: TASK_TYPES.deep, keywords: ['deep research', 'thorough research', 'full research'] },
    { type: TASK_TYPES.teamcode, keywords: ['team code', 'teamcode', 'parallel code', 'all agents code'] },
    { type: TASK_TYPES.review, check: (m) => m.includes('review') && (m.includes('code') || m.includes('file')) },
    { type: TASK_TYPES.debug, keywords: ['debug', 'fix', 'error', 'bug'] },
    { type: TASK_TYPES.apptest, check: (m) => m.includes('test') && m.includes('app') },
    { type: TASK_TYPES.test, keywords: ['test', 'unit test', 'write test'] },
    { type: TASK_TYPES.plan, keywords: ['plan', 'architect', 'design system', 'structure'] },
    { type: TASK_TYPES.doc, keywords: ['document', 'readme', 'summarize file', 'convert file'] },
    { type: TASK_TYPES.brainstorm, keywords: ['brainstorm', 'chat', 'discuss', 'idea'] },
    { type: TASK_TYPES.code, keywords: ['code', 'build', 'create', 'implement', 'write'] },
    { type: TASK_TYPES.research, keywords: ['research', 'find', 'search', 'look up', 'what is'] }
  ];

  for (const rule of rules) {
    if (rule.check && rule.check(msg)) {
      return rule.type;
    }
    if (rule.keywords && rule.keywords.some(kw => msg.includes(kw))) {
      return rule.type;
    }
  }

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
