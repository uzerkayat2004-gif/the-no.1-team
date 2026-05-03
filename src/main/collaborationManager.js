// collaborationManager.js
// Manages 3-round structured brainstorm sessions

const { EventEmitter } = require('events');
const agentRunner = require('./agentRunner');
const { injectSkill } = require('./skillBuilder');
const { getAllProfiles, getProfileForMode } = require('./providerProfiles');
const sessionCtx = require('./sessionContext');

const AGENT_TIMEOUT_MS = 90000; // 90s per agent per turn

class CollaborationManager extends EventEmitter {
  constructor() {
    super();
    this.sessions = {};
  }

  initBrainstorm(sessionId, agents, seniorAgent) {
    this.sessions[sessionId] = {
      agents, seniorAgent, round: 0, history: [],
      roles: this._assignRoles(agents, seniorAgent),
      votes: [], consensusReached: false,
    };
  }

  _assignRoles(agents, seniorAgent) {
    const others = agents.filter(a => a !== seniorAgent);
    const roles = {};
    roles[seniorAgent] = 'Proposer';
    if (others[0]) roles[others[0]] = 'Critic';
    if (others[1]) roles[others[1]] = 'Verifier';
    if (agents.length === 2) roles[others[0]] = 'Critic & Verifier';
    // For 4+ agents, extra agents become Devil's Advocates
    for (let i = 2; i < others.length; i++) {
      roles[others[i]] = "Devil's Advocate";
    }
    return roles;
  }

  async runFullBrainstorm({ sessionId, combinedDoc, task }) {
    const state = this.sessions[sessionId];
    if (!state) return [];
    const context = sessionCtx.getSession(sessionId);

    // Turn 1 — Positions
    state.round = 1;
    this.emit('round-start', { sessionId, round: 1, label: '🧠 Brainstorm — Turn 1: Initial Positions' });

    const turn1 = await this._runAllRoles(state, sessionId, (agentId, agentName, role, profile) =>
      injectSkill(agentName, 'deep',
        `BRAINSTORM TURN 1 — YOUR ROLE: ${role}\n` +
        (role === 'Proposer'
          ? 'Give the best, most complete answer or recommendation based on the research. Be specific and confident. End your position with your top 1-2 action items.'
          : role === 'Critic'
          ? 'Challenge the likely proposal with the top 3 potential weaknesses, risks, or blind spots. Be direct and back each point with evidence from the research.'
          : role === 'Verifier'
          ? 'Verify key claims in the research. For each major finding: rate its evidence strength (Strong/Moderate/Weak). Flag anything only one source supports.'
          : "Play devil's advocate. What is the strongest possible argument against the consensus view? Find the angle others are missing.")
        + `\nMax 200 words.\nTASK: ${task}\nRESEARCH SUMMARY: ${combinedDoc}`, context, profile)
    );
    turn1.forEach(r => state.history.push({ round: 1, ...r }));

    const conflictLevel1 = this._measureConflictLevel(turn1);
    if (conflictLevel1 === 'none') {
      this.emit('early-consensus', { sessionId, message: '✅ Team reached early consensus after Turn 1 — no significant conflicts.' });
      state.consensusReached = true;
      return turn1;
    }

    // Turn 2 — Challenges
    state.round = 2;
    this.emit('round-start', { sessionId, round: 2, label: '🧠 Brainstorm — Turn 2: Cross-Challenges' });
    const turn1Summary = turn1.map(r => `[${r.agentName} — ${state.roles[r.agentId]}]:\n${r.content}`).join('\n\n');

    const turn2 = await this._runAllRoles(state, sessionId, (agentId, agentName, role, profile) =>
      injectSkill(agentName, 'deep',
        `BRAINSTORM TURN 2 — CROSS-CHALLENGE\n` +
        `Pick the ONE weakest point from any teammate's Turn 1 position and challenge it head-on.\n` +
        `Back your challenge with specific evidence from the research.\n` +
        `Then defend your own Turn 1 position against likely criticism.\n` +
        `Max 200 words.\n\nTURN 1 POSITIONS:\n${turn1Summary}\n\nRESEARCH: ${combinedDoc}`, context, profile)
    );
    turn2.forEach(r => state.history.push({ round: 2, ...r }));

    const conflictLevel2 = this._measureConflictLevel(turn2);
    if (conflictLevel2 === 'none') {
      this.emit('early-consensus', { sessionId, message: '✅ Consensus reached after Turn 2 — team converged.' });
      state.consensusReached = true;
      return [...turn1, ...turn2];
    }

    // Turn 3 — Evidence Vote
    state.round = 3;
    this.emit('round-start', { sessionId, round: 3, label: '🧠 Brainstorm — Turn 3: Evidence Vote' });
    const fullDebate = [...turn1, ...turn2].map(r =>
      `[${r.agentName} — Round ${r.round || state.round}]:\n${r.content}`
    ).join('\n\n---\n\n');

    const turn3 = await this._runAllRoles(state, sessionId, (agentId, agentName, role, profile) =>
      injectSkill(agentName, 'deep',
        `BRAINSTORM TURN 3 — EVIDENCE VOTE\n` +
        `After reviewing the full debate, cast your final vote.\n\n` +
        `Format your response EXACTLY like this:\n` +
        `VOTE: [your final position in one clear sentence]\n` +
        `CONFIDENCE: [X/10]\n` +
        `EVIDENCE: [the single strongest piece of evidence that drives your vote]\n` +
        `CHANGED FROM TURN 1: [Yes/No — if Yes, explain what changed your mind]\n\n` +
        `FULL DEBATE:\n${fullDebate}`, context, profile)
    );
    turn3.forEach(r => state.history.push({ round: 3, ...r }));
    state.votes = turn3;

    const voteAnalysis = this._analyzeVotes(turn3);
    this.emit('votes-ready', { sessionId, voteAnalysis, votes: turn3 });

    if (voteAnalysis.isDeadlock) {
      this.emit('deadlock', { sessionId,
        message: `⚠️ Deadlock — agents could not reach majority agreement. ${turn3.length} votes cast, no majority.`,
        votes: turn3.map(r => ({ agent: r.agentName, vote: r.content })) });
    } else {
      state.consensusReached = true;
      if (voteAnalysis.winningVote) {
        this.emit('consensus-reached', { sessionId,
          message: `✅ Team reached consensus: "${voteAnalysis.winningVote.slice(0, 120)}"`,
          winningAgents: voteAnalysis.winningAgents });
      }
    }
    return [...turn1, ...turn2, ...turn3];
  }

  _runAllRoles(state, sessionId, buildPrompt) {
    const profiles = getAllProfiles();
    const context = sessionCtx.getSession(sessionId);
    return Promise.all(state.agents.map(agentId => {
      const profile = getProfileForMode(agentId, context?.executionModes?.[agentId]) || profiles[agentId];
      const agentName = profile?.name || agentId;
      const role = state.roles[agentId] || 'Team Member';
      return this._runCapture(agentId, agentName, buildPrompt(agentId, agentName, role, profile), sessionId);
    }));
  }

  _runCapture(agentId, agentName, prompt, sessionId) {
    const context = sessionCtx.getSession(sessionId);
    return new Promise((resolve) => {
      let fullResponse = '';
      let resolved = false;

      const finish = (content) => {
        if (resolved) return;
        resolved = true;
        agentRunner.removeListener('agent-chunk', onChunk);
        agentRunner.removeListener('agent-done', onDone);
        clearTimeout(timeout);
        resolve({ agentId, agentName, content: (content || fullResponse).trim() });
      };

      const onChunk = (data) => {
        if (data.sessionId === sessionId && data.agentId === agentId) fullResponse += data.content;
      };
      const onDone = (data) => {
        if (data.sessionId === sessionId && data.agentId === agentId) finish(fullResponse);
      };

      // Timeout safety — don't let one stuck agent block the whole brainstorm
      const timeout = setTimeout(() => {
        finish(fullResponse || `[${agentName} timed out before responding to this round]`);
      }, AGENT_TIMEOUT_MS);

      agentRunner.on('agent-chunk', onChunk);
      agentRunner.on('agent-done', onDone);
      agentRunner.sendToAgent({
        task: prompt, workDir: context?.workDir, agent: agentId,
        model: context?.models?.[agentId], executionMode: context?.executionModes?.[agentId], sessionId
      });
    });
  }

  // Measures how much real conflict exists — 'high', 'low', or 'none'
  _measureConflictLevel(results) {
    if (results.length <= 1) return 'none';
    const texts = results.map(r => r.content.toLowerCase());

    // Strong disagreement signals
    const strongConflict = [
      'disagree', 'incorrect', 'wrong', 'i disagree', 'that is wrong', 'that is incorrect',
      'not true', 'misleading', 'flawed', 'overstated', 'this is wrong', 'actually no',
      'contradict', 'challenge this', 'i dispute', 'that claim',
    ];
    // Weak/moderate conflict signals
    const weakConflict = [
      'however', 'but ', 'actually', 'missing', 'weakness', 'risk', 'concern',
      'caveat', 'be careful', 'watch out', 'not sure', 'uncertain', 'question',
      'unclear', 'ambiguous', 'might not', 'could be wrong', 'needs more',
    ];
    // Strong consensus signals
    const consensusSignals = [
      'agree', 'aligned', 'consensus', 'same conclusion', 'i concur',
      'correct', 'exactly right', 'good point', 'i agree with', 'supports this',
    ];

    const combined = texts.join(' ');
    const strongCount = strongConflict.filter(w => combined.includes(w)).length;
    const weakCount = weakConflict.filter(w => combined.includes(w)).length;
    const consensusCount = consensusSignals.filter(w => combined.includes(w)).length;

    if (strongCount >= 2) return 'high';
    if (weakCount >= 3 && consensusCount <= 1) return 'low';
    if (consensusCount >= 3 && strongCount === 0 && weakCount <= 1) return 'none';
    if (weakCount >= 1 || strongCount >= 1) return 'low';
    return 'none';
  }

  // Legacy — used by pipelineManager brainstorm check in mid/deep research
  _detectConflict(results) {
    return this._measureConflictLevel(results) !== 'none';
  }

  _analyzeVotes(voteResults) {
    const votes = voteResults.map(r => {
      // Try to extract the VOTE: line from structured output
      const match = r.content.match(/VOTE:\s*(.+?)(?:\n|CONFIDENCE:|EVIDENCE:|$)/si);
      const rawVote = match ? match[1].trim() : r.content.slice(0, 120);
      // Normalize: lowercase, remove punctuation, trim common prefixes
      const normalized = rawVote
        .toLowerCase()
        .replace(/^(i vote|my vote is|i believe|i think|the answer is)\s*/i, '')
        .replace(/[.,!?;:]+$/, '')
        .trim();
      return { agentId: r.agentId, agentName: r.agentName, vote: rawVote, normalized };
    });

    // Group by first 60 chars of normalized vote
    const groups = {};
    votes.forEach(v => {
      const key = v.normalized.slice(0, 60);
      // Try to find an existing group that's a close match (starts with same 40 chars)
      const existingKey = Object.keys(groups).find(k =>
        k.slice(0, 40) === key.slice(0, 40)
      );
      const groupKey = existingKey || key;
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(v);
    });

    const sorted = Object.values(groups).sort((a, b) => b.length - a.length);
    const maxGroup = sorted[0];
    const isDeadlock = !maxGroup || sorted.every(g => g.length === 1);
    const isMajority = maxGroup && maxGroup.length > Math.floor(votes.length / 2);
    const isUnanimous = maxGroup && maxGroup.length === votes.length;

    return {
      votes,
      isDeadlock,
      isMajority,
      isUnanimous,
      winningVote: isMajority ? maxGroup[0].vote : null,
      winningAgents: isMajority ? maxGroup.map(v => v.agentName) : [],
      totalVotes: votes.length,
    };
  }

  getTranscript(sessionId) {
    const state = this.sessions[sessionId];
    if (!state) return '';
    return state.history.map(r =>
      `[Round ${r.round} — ${r.agentName} — ${state.roles[r.agentId] || 'Team'}]:\n${r.content}`
    ).join('\n\n---\n\n');
  }

  clearSession(sessionId) { delete this.sessions[sessionId]; }
}

module.exports = new CollaborationManager();
