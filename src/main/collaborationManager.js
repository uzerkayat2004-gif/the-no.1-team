// collaborationManager.js
// Manages 3-round structured brainstorm sessions

const { EventEmitter } = require('events');
const agentRunner = require('./agentRunner');
const { injectSkill } = require('./skillBuilder');
const { getAllProfiles } = require('./providerProfiles');
const sessionCtx = require('./sessionContext');

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
    return roles;
  }

  async runFullBrainstorm({ sessionId, combinedDoc, task }) {
    const state = this.sessions[sessionId];
    if (!state) return [];
    const context = sessionCtx.getSession(sessionId);

    // Turn 1 — Positions
    state.round = 1;
    this.emit('round-start', { sessionId, round: 1, label: '🧠 Brainstorm — Turn 1: Positions' });

    const turn1 = await this._runAllRoles(state, sessionId, (agentId, agentName, role) =>
      injectSkill(agentName, 'deep',
        `BRAINSTORM TURN 1 — YOUR ROLE: ${role}\n` +
        (role === 'Proposer'
          ? 'Give the best, most complete answer based on the research. Be specific and confident.'
          : role === 'Critic'
          ? 'Find the top 3 potential weaknesses or risks. Be direct and specific.'
          : 'Verify key claims. What has strong evidence? What needs more proof?') +
        `\nMax 200 words.\nTASK: ${task}\nRESEARCH: ${combinedDoc}`, context)
    );
    turn1.forEach(r => state.history.push({ round: 1, ...r }));

    if (!this._detectConflict(turn1)) {
      this.emit('early-consensus', { sessionId, message: '✅ Team reached early consensus.' });
      state.consensusReached = true;
      return turn1;
    }

    // Turn 2 — Challenges
    state.round = 2;
    this.emit('round-start', { sessionId, round: 2, label: '🧠 Brainstorm — Turn 2: Challenges' });
    const turn1Summary = turn1.map(r => `[${r.agentName} — ${state.roles[r.agentId]}]: ${r.content}`).join('\n\n');

    const turn2 = await this._runAllRoles(state, sessionId, (agentId, agentName, role) =>
      injectSkill(agentName, 'deep',
        `BRAINSTORM TURN 2 — CROSS CHALLENGE\nChallenge the weakest point from EACH teammate. Back with evidence. Max 200 words.\nTURN 1:\n${turn1Summary}\nRESEARCH: ${combinedDoc}`, context)
    );
    turn2.forEach(r => state.history.push({ round: 2, ...r }));

    if (!this._detectConflict(turn2)) {
      this.emit('early-consensus', { sessionId, message: '✅ Consensus reached after Turn 2.' });
      state.consensusReached = true;
      return [...turn1, ...turn2];
    }

    // Turn 3 — Evidence Vote
    state.round = 3;
    this.emit('round-start', { sessionId, round: 3, label: '🧠 Brainstorm — Turn 3: Evidence Vote' });
    const fullDebate = [...turn1, ...turn2].map(r => `[${r.agentName} — Round ${r.round || state.round}]: ${r.content}`).join('\n\n');

    const turn3 = await this._runAllRoles(state, sessionId, (agentId, agentName, role) =>
      injectSkill(agentName, 'deep',
        `BRAINSTORM TURN 3 — EVIDENCE VOTE\nVOTE: [your answer in one sentence]\nEVIDENCE: [why - one paragraph]\nVote on EVIDENCE quality.\nDEBATE:\n${fullDebate}`, context)
    );
    turn3.forEach(r => state.history.push({ round: 3, ...r }));
    state.votes = turn3;

    const voteAnalysis = this._analyzeVotes(turn3);
    this.emit('votes-ready', { sessionId, voteAnalysis, votes: turn3 });

    if (voteAnalysis.isDeadlock) {
      this.emit('deadlock', { sessionId, message: '⚠️ Deadlock — agents could not agree.',
        votes: turn3.map(r => ({ agent: r.agentName, vote: r.content })) });
    } else {
      state.consensusReached = true;
    }
    return [...turn1, ...turn2, ...turn3];
  }

  _runAllRoles(state, sessionId, buildPrompt) {
    const profiles = getAllProfiles();
    return Promise.all(state.agents.map(agentId => {
      const agentName = profiles[agentId]?.name || agentId;
      const role = state.roles[agentId] || 'Team Member';
      return this._runCapture(agentId, agentName, buildPrompt(agentId, agentName, role), sessionId);
    }));
  }

  _runCapture(agentId, agentName, prompt, sessionId) {
    const context = sessionCtx.getSession(sessionId);
    return new Promise((resolve) => {
      let fullResponse = '';
      const onChunk = (data) => { if (data.sessionId === sessionId && data.agentId === agentId) fullResponse += data.content; };
      const onDone = (data) => {
        if (data.sessionId === sessionId && data.agentId === agentId) {
          agentRunner.removeListener('agent-chunk', onChunk);
          agentRunner.removeListener('agent-done', onDone);
          resolve({ agentId, agentName, content: fullResponse.trim() });
        }
      };
      agentRunner.on('agent-chunk', onChunk);
      agentRunner.on('agent-done', onDone);
      agentRunner.sendToAgent({ task: prompt, workDir: context?.workDir, agent: agentId, model: context?.models?.[agentId], sessionId });
    });
  }

  _detectConflict(results) {
    const text = results.map(r => r.content.toLowerCase()).join(' ');
    return ['disagree', 'however', 'but ', 'actually', 'incorrect', 'wrong', 'missing', 'weakness', 'risk'].some(w => text.includes(w));
  }

  _analyzeVotes(voteResults) {
    const votes = voteResults.map(r => {
      const match = r.content.match(/VOTE:\s*(.+?)(?:\n|EVIDENCE:|$)/si);
      return { agentId: r.agentId, agentName: r.agentName, vote: match ? match[1].trim() : r.content.slice(0, 100) };
    });
    const groups = {};
    votes.forEach(v => { const key = v.vote.slice(0, 40).toLowerCase(); if (!groups[key]) groups[key] = []; groups[key].push(v); });
    const sorted = Object.values(groups).sort((a, b) => b.length - a.length);
    const maxGroup = sorted[0];
    const isDeadlock = sorted.every(g => g.length === 1);
    const isMajority = maxGroup && maxGroup.length > Math.floor(votes.length / 2);
    return { votes, isDeadlock, isMajority, winningVote: isMajority ? maxGroup[0].vote : null, winningAgents: isMajority ? maxGroup.map(v => v.agentName) : [] };
  }

  getTranscript(sessionId) {
    const state = this.sessions[sessionId];
    if (!state) return '';
    return state.history.map(r => `[Round ${r.round} — ${r.agentName} — ${state.roles[r.agentId] || 'Team'}]:\n${r.content}`).join('\n\n---\n\n');
  }

  clearSession(sessionId) { delete this.sessions[sessionId]; }
}

module.exports = new CollaborationManager();
