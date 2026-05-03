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
  if (typeof message !== 'string') return null;
  const match = message.match(/^\/(\w+)/);
  if (!match) return null;
  const cmd = match[1].toLowerCase();
  return TASK_TYPES[cmd] || null;
}

// Scoring-based keyword detection — returns best match with confidence
function detectFromKeywords(message) {
  if (typeof message !== 'string') return TASK_TYPES.general;
  const msg = message.toLowerCase().trim();

  const scores = {};
  const score = (type, points) => { scores[type] = (scores[type] || 0) + points; };

  // ── Quick Research ────────────────────────────────────────────
  if (/\b(quick research|fast research|quick search|quick answer|tldr|tl;dr|brief overview|quick summary)\b/.test(msg)) score('quick', 10);
  if (/^(what is|what are|who is|who are|when did|when was|where is|where are)\b/.test(msg)) score('quick', 6);
  if (/\b(define|definition of|meaning of|what does .+ mean)\b/.test(msg)) score('quick', 6);
  if (/\b(tell me about|quick question|simple question)\b/.test(msg)) score('quick', 4);

  // ── Mid Research ─────────────────────────────────────────────
  if (/\b(research|find out|look up|investigate|study|survey|overview of|report on)\b/.test(msg)) score('research', 6);
  if (/\b(compare|comparison|versus|vs\.?|difference(s)? between|pros and cons|trade.?off)\b/.test(msg)) score('research', 7);
  if (/\b(how does .+ work|explain how|explain why|why does|why is|how do)\b/.test(msg)) score('research', 5);
  if (/\b(best practices|recommended approach|industry standard|state of the art)\b/.test(msg)) score('research', 6);
  if (/\b(latest|current|today|recent|new|2024|2025|2026)\b/.test(msg)) score('research', 3);

  // ── Deep Research ─────────────────────────────────────────────
  if (/\b(deep research|thorough research|full research|comprehensive research|exhaustive|in.?depth|detailed analysis)\b/.test(msg)) score('deep', 10);
  if (/\b(analyze|analyse|evaluate|assess|audit|review thoroughly|full audit)\b/.test(msg) && !/\bcode\b/.test(msg)) score('deep', 7);
  if (/\b(market research|competitive analysis|landscape analysis|industry analysis)\b/.test(msg)) score('deep', 8);
  if (/\b(research .+ from .+ angles|all perspectives|multiple viewpoints|full picture)\b/.test(msg)) score('deep', 8);

  // ── Coding ────────────────────────────────────────────────────
  if (/\b(write (a |the |some )?(code|function|class|component|script|module|api|endpoint))\b/.test(msg)) score('code', 9);
  if (/\b(implement|build|create|develop|code up|program)\b/.test(msg) && /\b(feature|function|class|module|component|app|tool|script|bot|system|service)\b/.test(msg)) score('code', 8);
  if (/\b(refactor|optimize|improve|rewrite|clean up|restructure)\b/.test(msg) && /\b(code|function|class|file|module|component)\b/.test(msg)) score('code', 7);
  if (/\b(add (a |the )?(feature|button|field|column|route|endpoint|method|property))\b/.test(msg)) score('code', 7);
  if (/\b(how (do i|do you|to) code|how (do i|do you|to) implement|show me (the |a )?code)\b/.test(msg)) score('code', 5);

  // ── Team Coding ───────────────────────────────────────────────
  if (/\b(team code|teamcode|parallel code|all agents code|everyone code|full.?stack)\b/.test(msg)) score('teamcode', 10);
  if (/\b(build .+ together|multi.?agent (code|build)|collaborative (coding|development))\b/.test(msg)) score('teamcode', 9);

  // ── Code Review ───────────────────────────────────────────────
  if (/\b(review (this |my |the )?(code|file|pr|pull request|diff|change|function|class|module))\b/.test(msg)) score('review', 10);
  if (/\b(code review|peer review|check (this |my )?(code|file|function))\b/.test(msg)) score('review', 10);
  if (/\b(is (this|my) code (good|correct|right|ok|fine|proper|clean))\b/.test(msg)) score('review', 7);

  // ── Debugging ─────────────────────────────────────────────────
  if (/\b(debug|debugging|breakpoint|stack trace|traceback|runtime error)\b/.test(msg)) score('debug', 9);
  if (/\b(fix (the |this |my |a )?(bug|error|issue|problem|crash|exception|failure))\b/.test(msg)) score('debug', 9);
  if (/\b(it('s| is) (broken|not working|failing|crashing)|something('s| is) wrong)\b/.test(msg)) score('debug', 7);
  if (/\b(error:|exception:|traceback:|uncaught|undefined is not|cannot read|typeerror|syntaxerror|referenceerror)\b/.test(msg)) score('debug', 9);
  if (/\b(why (is|does|won't|doesn't|can't|isn't) .+ (work|run|execute|compile|load))\b/.test(msg)) score('debug', 5);

  // ── Planning ──────────────────────────────────────────────────
  if (/\b(plan|planning|architect|architecture|design (system|pattern|the|a|this)|structure|blueprint|roadmap|strategy)\b/.test(msg)) score('plan', 7);
  if (/\b(sprint|backlog|milestone|feature list|technical spec|spec document|system design)\b/.test(msg)) score('plan', 8);
  if (/\b(how (should|would|do) (i|we|you) (build|structure|design|approach|organize))\b/.test(msg)) score('plan', 6);
  if (/\b(best (way|approach|method|pattern) to (build|create|design|structure|implement))\b/.test(msg)) score('plan', 6);
  if (/\b(tech stack|technology (choice|stack|selection)|what (tech|stack|framework|language|library))\b/.test(msg)) score('plan', 5);

  // ── Testing ───────────────────────────────────────────────────
  if (/\b(write (tests?|unit tests?|integration tests?|test cases?|test suite))\b/.test(msg)) score('test', 10);
  if (/\b(unit test|integration test|test coverage|tdd|test.?driven)\b/.test(msg)) score('test', 9);
  if (/\b(add tests?( for| to)?|test (this|my|the) (function|code|class|module|component))\b/.test(msg)) score('test', 8);

  // ── App Testing ───────────────────────────────────────────────
  if (/\b(test (the |my |this )?(app|application|website|ui|frontend|browser|page))\b/.test(msg)) score('apptest', 9);
  if (/\b(e2e|end.?to.?end|browser test|visual test|screenshot test|selenium|playwright|cypress)\b/.test(msg)) score('apptest', 10);

  // ── Documentation ─────────────────────────────────────────────
  if (/\b(write (a |the )?(readme|documentation|docs?|wiki|guide|tutorial|changelog|api docs?))\b/.test(msg)) score('doc', 10);
  if (/\b(document (this|my|the)|add (comments?|jsdoc|docstrings?|annotations?))\b/.test(msg)) score('doc', 8);
  if (/\b(summarize (this|the|my) (file|code|document|repo|codebase))\b/.test(msg)) score('doc', 7);
  if (/\b(convert (this|the|my) (file|document|markdown|html|pdf|csv|json))\b/.test(msg)) score('doc', 6);
  if (/\b(write (an? )?(article|essay|blog post|post|write-up|report))\b/.test(msg)) score('doc', 5);

  // ── Brainstorm ────────────────────────────────────────────────
  if (/\b(brainstorm|chat (with|to) (agents?|team|claude|codex|gemini)|discuss|let('s| us) (think|talk|discuss))\b/.test(msg)) score('brainstorm', 9);
  if (/\b(throw (ideas|thoughts) around|free.?form|open discussion|group chat|talk through)\b/.test(msg)) score('brainstorm', 8);
  if (/\b(what (do you|does the team) think( about)?|opinions? on|thoughts? on)\b/.test(msg)) score('brainstorm', 6);
  if (/\b(idea (for|about)|generate (ideas?|options?|alternatives?)|what (could|should|might) we)\b/.test(msg)) score('brainstorm', 5);

  // Find the highest-scoring type
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] >= 5) return TASK_TYPES[best[0]] || TASK_TYPES.general;

  // Low-confidence fallbacks using simpler heuristics
  if (/\b(code|build|create|implement|write|make|add)\b/.test(msg)) return TASK_TYPES.code;
  if (/\b(research|find|search|look up|what is|what are|how does)\b/.test(msg)) return TASK_TYPES.research;

  return TASK_TYPES.general;
}

function detectResearchPolicy(message, taskType) {
  const taskId = typeof taskType === 'string' ? taskType : taskType?.id;
  const msg = typeof message === 'string' ? message.toLowerCase() : '';
  const freshnessTerms = [
    'latest', 'current', 'today', 'live', 'now', 'recent', 'news', 'pricing',
    'docs', 'documentation', 'api', 'version', 'release', 'released', 'updated',
    '2024', '2025', '2026', 'this year', 'this month', 'this week', 'right now',
    'real.?time', 'up.?to.?date', 'up to date', 'just released', 'just launched',
    'newly', 'fresh', 'as of', 'at the moment', 'at this point',
  ];
  const freshnessRequired = freshnessTerms.some(term => new RegExp(`\\b${term}\\b`, 'i').test(msg));
  const researchDepth = { quick: 1, research: 3, deep: 5 };
  const isResearchTask = Object.prototype.hasOwnProperty.call(researchDepth, taskId);
  const planOrGeneralNeedsResearch = ['plan', 'general'].includes(taskId) && freshnessRequired;
  const requiresCurrentResearch = isResearchTask || planOrGeneralNeedsResearch;

  return {
    requiresCurrentResearch,
    requireUrls: requiresCurrentResearch,
    minSources: isResearchTask ? researchDepth[taskId] : (requiresCurrentResearch ? 2 : 0),
    freshnessRequired: requiresCurrentResearch,
    staleFactsForbidden: requiresCurrentResearch,
    depth: isResearchTask ? taskId : null,
  };
}

// Main detection function
function detectTaskType(message) {
  const fromSlash = detectFromSlash(message);
  if (fromSlash) return { taskType: fromSlash, fromSlash: true, researchPolicy: detectResearchPolicy(message, fromSlash) };

  const fromKeywords = detectFromKeywords(message);
  return { taskType: fromKeywords, fromSlash: false, researchPolicy: detectResearchPolicy(message, fromKeywords) };
}

// Strip slash command from message before sending to agents
function stripSlashCommand(message) {
  if (typeof message !== 'string') {
    return (message === null || message === undefined) ? '' : String(message);
  }
  return message.replace(/^\/\w+\s*/, '').trim();
}

// Check if a slash command message has an actual topic after the command
function hasTopicAfterSlash(message) {
  if (typeof message !== 'string') return false;
  const stripped = message.replace(/^\/\w+\s*/, '').trim();
  return stripped.length > 0;
}

module.exports = { detectTaskType, detectResearchPolicy, stripSlashCommand, hasTopicAfterSlash, TASK_TYPES };
