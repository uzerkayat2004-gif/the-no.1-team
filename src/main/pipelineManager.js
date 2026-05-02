// pipelineManager.js
// Controls the full task pipeline for each task type

const { EventEmitter } = require('events');
const agentRunner      = require('./agentRunner');
const { injectSkill }  = require('./skillBuilder');
const { getAllProfiles, normalizeExecutionMode, getProfileForMode } = require('./providerProfiles');
const sessionCtx       = require('./sessionContext');
const collaborationManager = require('./collaborationManager');
const { detectResearchPolicy } = require('./taskDetector');

const DEPTH_BY_TASK = {
  quick: 1,
  research: 2,
  deep: 3,
  plan: 2,
  code: 2,
  teamcode: 3,
  review: 2,
  debug: 2,
  test: 2,
  apptest: 2,
  doc: 1,
  brainstorm: 2,
  general: 1,
};

class PipelineManager extends EventEmitter {
  constructor() {
    super();
    this.pipelines = {};
  }

  async startPipeline({ sessionId, taskType, task, agents, models, subagentModels, executionModes, workDir, mode, seniorAgent }) {
    // Validate topic — do not run pipeline with empty task
    if (!task || task.trim().length < 3) {
      this.emit('system-message', { sessionId, message: '⚠️ No topic provided. Please type your topic and send again.' });
      this.emit('pipeline-cancelled', { sessionId, reason: 'No topic provided' });
      return;
    }

    const profiles = getAllProfiles();
    const normalizedExecutionModes = {};
    agents.forEach(agentId => {
      normalizedExecutionModes[agentId] = normalizeExecutionMode(agentId, executionModes?.[agentId]);
    });
    if (!sessionCtx.getSession(sessionId)) {
      sessionCtx.createSession(sessionId, {
        sessionId,
        activeAgents: agents.map(id => profiles[id]?.name || id),
        mode,
        seniorAgent,
        workDir,
        executionModes: normalizedExecutionModes,
      });
    }

    const depth = DEPTH_BY_TASK[taskType] || 2;
    const pipeline = {
      sessionId, taskType, task, depth, agents, models: models || {}, subagentModels: subagentModels || {},
      executionModes: normalizedExecutionModes,
      workDir, mode, seniorAgent: seniorAgent || agents[0],
      researchPolicy: detectResearchPolicy(task, taskType), researchValidation: {},
      phase: 'phase-0-task-created', researchData: {}, combinedDoc: null,
      brainstormLog: [], decisions: [], finalAnswer: null, sendBackCount: 0, waitingForBoss: false,
    };
    this.pipelines[sessionId] = pipeline;
    sessionCtx.updateSession(sessionId, { task, taskType, depth, seniorAgent: pipeline.seniorAgent, workDir, phase: pipeline.phase, researchPolicy: pipeline.researchPolicy, executionModes: pipeline.executionModes });
    this.emit('pipeline-start', { sessionId, taskType, task });

    switch(taskType) {
      case 'quick':      await this._runQuickResearch(pipeline);  break;
      case 'research':   await this._runMidResearch(pipeline);    break;
      case 'deep':       await this._runDeepResearch(pipeline);   break;
      case 'code':       await this._runCoding(pipeline);         break;
      case 'teamcode':   await this._runTeamCoding(pipeline);     break;
      case 'review':     await this._runCodeReview(pipeline);     break;
      case 'debug':      await this._runDebugging(pipeline);      break;
      case 'plan':       await this._runPlanning(pipeline);       break;
      case 'test':       await this._runTesting(pipeline);        break;
      case 'apptest':    await this._runAppTesting(pipeline);     break;
      case 'doc':        await this._runDocument(pipeline);       break;
      case 'brainstorm': await this._runBrainstormChat(pipeline); break;
      default:           await this._runGeneral(pipeline);        break;
    }
  }

  bossApprove(sessionId) {
    const p = this.pipelines[sessionId];
    if (!p || !p.waitingForBoss) return;
    p.waitingForBoss = false;
    this.emit('boss-approved', { sessionId });
    p._resolveCheckpoint && p._resolveCheckpoint('approved');
  }

  bossSendBack(sessionId, targetAgent, reason) {
    const p = this.pipelines[sessionId];
    if (!p) return;
    p.sendBackCount++;
    p.waitingForBoss = false;
    if (p.sendBackCount >= 3) {
      this.emit('checkpoint', { sessionId, type: 'max-sendbacks',
        message: '⚠️ Maximum send-backs reached.', buttons: ['Force Approve', 'Cancel Task'] });
      return;
    }
    this.emit('send-back', { sessionId, targetAgent, reason, count: p.sendBackCount });
    p._resolveCheckpoint && p._resolveCheckpoint({ action: 'sendback', targetAgent, reason });
  }

  bossCancel(sessionId, reason) {
    const p = this.pipelines[sessionId];
    if (!p) return;
    p.waitingForBoss = false;
    this.emit('pipeline-cancelled', { sessionId, reason });
    p._resolveCheckpoint && p._resolveCheckpoint('cancelled');
    delete this.pipelines[sessionId];
  }

  _checkpoint(pipeline, checkpointData) {
    return new Promise((resolve) => {
      // In auto mode, skip ONLY low-stakes intermediate checkpoints.
      // NEVER auto-approve research-complete — always wait for Boss review.
      const autoSkipTypes = ['plan-approval', 'plans-ready', 'diagnosis-complete'];
      if (pipeline.mode === 'auto' && autoSkipTypes.includes(checkpointData.type)) {
        this.emit('auto-approved', {
          sessionId: pipeline.sessionId,
          message: checkpointData.message
        });
        resolve('approved');
        return;
      }
      // All other checkpoints — including research-complete and final-answer —
      // ALWAYS require Boss input regardless of mode.
      pipeline.waitingForBoss = true;
      pipeline._resolveCheckpoint = resolve;
      this.emit('checkpoint', { sessionId: pipeline.sessionId, ...checkpointData });
    });
  }

  _runAgentCapture(pipeline, agentId, prompt, options = {}) {
    return new Promise((resolve) => {
      const profiles = getAllProfiles();
      const agentName = profiles[agentId]?.name || agentId;
      let fullResponse = '';
      let lastError = '';
      let resolved = false;
      const finish = (content) => {
        if (resolved) return;
        resolved = true;
        agentRunner.removeListener('agent-chunk', onChunk);
        agentRunner.removeListener('agent-error', onError);
        agentRunner.removeListener('agent-done', onDone);
        clearTimeout(timeout);
        resolve({ agentId, agentName, content: content.trim() });
      };
      const onChunk = (data) => {
        if (data.sessionId === pipeline.sessionId && data.agentId === agentId) fullResponse += data.content;
      };
      const onError = (data) => {
        if (data.sessionId === pipeline.sessionId && data.agentId === agentId) lastError = data.error;
      };
      const onDone = (data) => {
        if (data.sessionId === pipeline.sessionId && data.agentId === agentId) {
          const content = fullResponse.trim() || (lastError ? `⚠️ ${agentName} failed: ${lastError}` : `⚠️ ${agentName} finished without a response.`);
          finish(content);
        }
      };
      const timeout = setTimeout(() => {
        finish(fullResponse || `⚠️ ${agentName} timed out before replying.`);
      }, options.timeoutMs || 120000);
      agentRunner.on('agent-chunk', onChunk);
      agentRunner.on('agent-error', onError);
      agentRunner.on('agent-done', onDone);
      const proc = agentRunner.sendToAgent({ task: prompt, workDir: pipeline.workDir, agent: agentId,
        model: pipeline.models?.[agentId], subagentModel: pipeline.subagentModels?.[agentId],
        executionMode: pipeline.executionModes?.[agentId],
        sessionId: pipeline.sessionId, silent: options.silent });
      if (!proc) finish(`⚠️ ${agentName} could not be started.`);
    });
  }

  _runAllAgentsCapture(pipeline, buildPrompt, options = {}) {
    return Promise.all(pipeline.agents.map(agentId => {
      const profile = this._getProviderProfile(pipeline, agentId);
      const agentName = profile?.name || agentId;
      const prompt = buildPrompt(agentId, agentName, profile);
      return this._runAgentCapture(pipeline, agentId, prompt, options)
        .catch(err => {
          // If one agent fails, don't fail the whole pipeline
          console.error(`[Pipeline] Agent ${agentName} failed:`, err);
          return { agentId, agentName, content: `[${agentName} could not complete — ${err.message || 'unknown error'}]`, failed: true };
        });
    }));
  }

  _flagConfidence(results) {
    return results.map(r => `\n=== ${r.agentName} ===\n${r.content}\n`).join('\n');
  }

  _extractUrls(text) {
    const matches = String(text || '').match(/https?:\/\/[^\s)\]}>"]+/g) || [];
    return [...new Set(matches.map(url => url.replace(/[.,;:]+$/, '')))];
  }

  _validateResearchResult(result, policy, providerProfile) {
    if (!policy?.requiresCurrentResearch) {
      return { ok: true, status: 'ready', urlCount: 0, urls: [], issues: [] };
    }

    const content = result?.content || '';
    const lower = content.toLowerCase();
    const urls = this._extractUrls(content).filter(url => !/example\.com|source\.com|\[link\]|citation-needed/i.test(url));
    const issues = [];
    const webSearch = providerProfile?.researchCapabilities?.webSearch || 'unknown';
    const noWebAccess = lower.includes('no_web_access') || lower.includes('[research blocked]');
    const staleMemory = [
      'as of my last update',
      'i cannot browse',
      'cannot browse',
      'no access to current',
      'do not have access to current',
    ].some(phrase => lower.includes(phrase));

    if (noWebAccess) {
      return { ok: false, status: 'blocked', urlCount: urls.length, urls, issues: ['Provider reported no live web access.'] };
    }
    if (staleMemory) issues.push('Output contains stale-memory/no-browser language.');
    if (policy.requireUrls && urls.length < (policy.minSources || 1)) {
      issues.push(`Expected at least ${policy.minSources || 1} source URL(s), found ${urls.length}.`);
    }
    if (webSearch !== 'native' && webSearch !== 'app-provided') {
      issues.push('Provider web access is not confirmed by app configuration.');
    }

    const ok = issues.length === 0;
    return { ok, status: ok ? 'ready' : 'failed', urlCount: urls.length, urls, issues };
  }

  _validateResearchBatch(results, policy, profiles) {
    const byAgent = {};
    results.forEach(result => {
      byAgent[result.agentId] = this._validateResearchResult(result, policy, profiles[result.agentId]);
    });
    const summary = Object.values(byAgent).reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      acc.totalSources += item.urlCount || 0;
      return acc;
    }, { ready: 0, failed: 0, blocked: 0, warning: 0, totalSources: 0 });
    return { byAgent, summary };
  }

  _readyResearchResults(results, validation) {
    if (!validation?.byAgent) return results;
    return results.filter(result => validation.byAgent[result.agentId]?.status === 'ready');
  }

  async _stopIfNoReadyResearch(pipeline, readyResults) {
    if (!pipeline.researchPolicy?.requiresCurrentResearch || readyResults.length > 0) return false;
    const summary = pipeline.researchValidation?.summary || {};
    pipeline.finalAnswer = `Research blocked: no agent produced validation-ready current research. Ready: ${summary.ready || 0}, blocked: ${summary.blocked || 0}, failed: ${summary.failed || 0}, validated source URLs: ${summary.totalSources || 0}.`;
    await this._checkpoint(pipeline, {
      type: 'research-validation-failed',
      message: 'Research Validation Failed',
      description: pipeline.finalAnswer,
      buttons: ['Cancel ❌'],
    });
    this.emit('pipeline-cancelled', { sessionId: pipeline.sessionId, reason: pipeline.finalAnswer });
    return true;
  }

  _setPhase(pipeline, phase, label) {
    pipeline.phase = phase;
    sessionCtx.updateSession(pipeline.sessionId, { phase, decisions: pipeline.decisions });
    if (label) this._emitRoundHeader(pipeline.sessionId, label);
  }

  _phasePrompt(pipeline, phaseName, body) {
    return `PHASE: ${phaseName}\nBoss task: ${pipeline.task}\nDepth level: ${pipeline.depth}\nSenior agent: ${pipeline.seniorAgent}\n\n${body}`;
  }

  _recordDecision(pipeline, decision) {
    pipeline.decisions.push({ decision, timestamp: new Date().toISOString() });
    sessionCtx.updateSession(pipeline.sessionId, { decisions: pipeline.decisions });
  }

  _emitRoundHeader(sessionId, label) { this.emit('round-header', { sessionId, label }); }
  _emitSystem(sessionId, message) { this.emit('system-message', { sessionId, message }); }

  _getProviderProfile(pipeline, agentId) {
    return getProfileForMode(agentId, pipeline.executionModes?.[agentId]) || getAllProfiles()[agentId];
  }

  _getProviderProfiles(pipeline) {
    const profiles = getAllProfiles();
    Object.keys(profiles).forEach(agentId => {
      profiles[agentId] = this._getProviderProfile(pipeline, agentId);
    });
    return profiles;
  }

  // ── QUICK RESEARCH ──
  async _runQuickResearch(pipeline) {
    const { sessionId, task, seniorAgent } = pipeline;
    this._emitRoundHeader(sessionId, '⚡ Quick Research — Starting');
    const results = await this._runAllAgentsCapture(pipeline, (agentId, agentName) =>
      injectSkill(agentName, 'quick', task, sessionCtx.getSession(sessionId), this._getProviderProfile(pipeline, agentId)),
      { silent: true }
    );
    results.forEach(r => { pipeline.researchData[r.agentId] = r.content; });
    const profiles = this._getProviderProfiles(pipeline);
    pipeline.researchValidation = this._validateResearchBatch(results, pipeline.researchPolicy, profiles);
    sessionCtx.updateSession(sessionId, { researchValidation: pipeline.researchValidation });
    this.emit('research-ready', { sessionId, researchData: pipeline.researchData, researchValidation: pipeline.researchValidation });
    const readyResults = this._readyResearchResults(results, pipeline.researchValidation);
    if (await this._stopIfNoReadyResearch(pipeline, readyResults)) return;

    this._emitRoundHeader(sessionId, '📋 Combining Results...');
    const final = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(profiles[seniorAgent]?.name || seniorAgent, 'quick',
        `Combine ONLY validation-ready research into one clean bullet-point summary. Do not use failed or NO_WEB_ACCESS content as factual evidence. Every final bullet must include a source URL.\n${this._flagConfidence(readyResults)}`,
        sessionCtx.getSession(sessionId), profiles[seniorAgent]),
      { silent: true }
    );
    pipeline.finalAnswer = final.content;

    const decision = await this._checkpoint(pipeline, {
      type: 'final-answer', message: '⚡ Quick Research Complete',
      description: 'Results combined. Review and approve.',
      buttons: ['Approve ✅', 'Send Back 🔄', 'Cancel ❌'],
    });
    if (decision === 'approved') this.emit('pipeline-complete', { sessionId, finalAnswer: pipeline.finalAnswer });
  }

  // ── MID RESEARCH ──
  async _runMidResearch(pipeline) {
    let { sessionId, task, seniorAgent } = pipeline;
    seniorAgent = seniorAgent || pipeline.agents[0];
    this._setPhase(pipeline, 'phase-2-independent-research', '🔍 Phase 2 — Independent Research');
    const results = await this._runAllAgentsCapture(pipeline, (agentId, agentName) =>
      injectSkill(agentName, 'research', this._phasePrompt(pipeline, 'Phase 2 — Independent Research',
        `Research independently. Do not reference other agents.\nReturn findings, sources, and Confidence: X/10 per major finding.\nFlag low-confidence items below 6/10.\n\nResearch question:\n${task}`), sessionCtx.getSession(sessionId), this._getProviderProfile(pipeline, agentId)),
      { silent: true }
    );
    results.forEach(r => { pipeline.researchData[r.agentId] = r.content; });
    const profiles = this._getProviderProfiles(pipeline);
    pipeline.researchValidation = this._validateResearchBatch(results, pipeline.researchPolicy, profiles);
    sessionCtx.updateSession(sessionId, { researchValidation: pipeline.researchValidation });
    this.emit('research-ready', { sessionId, researchData: pipeline.researchData, researchValidation: pipeline.researchValidation });

    const c1 = await this._checkpoint(pipeline, { type: 'research-complete', message: '🔍 Research Complete',
      description: 'All agents submitted research. Review Research Panel.',
      buttons: ['Approve Research ✅', 'Send Back 🔄', 'Cancel ❌'] });
    if (c1 === 'cancelled') return;
    if (c1?.action === 'sendback') {
      const reason = c1.reason || 'Please improve the research quality.';
      const targetId = c1.targetAgent || null;
      this._emitSystem(sessionId, `🔄 Sending back for revision: ${reason}`);
      const agentsToRevise = targetId ? [targetId] : pipeline.agents;
      const revisions = await Promise.all(
        agentsToRevise.map(agentId => {
          const agentName = profiles[agentId]?.name || agentId;
          return this._runAgentCapture(pipeline, agentId,
            injectSkill(agentName, 'research',
              `REVISION REQUEST FROM BOSS: ${reason}\n\nYour previous research:\n${pipeline.researchData[agentId] || 'None submitted'}\n\nPlease improve and resubmit with better sources and higher confidence scores.`,
              sessionCtx.getSession(sessionId), profiles[agentId]),
            { silent: true }
          );
        })
      );
      revisions.forEach(r => {
        if (r) pipeline.researchData[r.agentId] = r.content;
      });
      pipeline.researchValidation = this._validateResearchBatch(
        Object.entries(pipeline.researchData).map(([agentId, content]) => ({ agentId, agentName: profiles[agentId]?.name || agentId, content })),
        pipeline.researchPolicy,
        profiles
      );
      sessionCtx.updateSession(sessionId, { researchValidation: pipeline.researchValidation });
      this.emit('research-ready', { sessionId, researchData: pipeline.researchData, researchValidation: pipeline.researchValidation });
    }

    const readyResults = this._readyResearchResults(results, pipeline.researchValidation);
    if (await this._stopIfNoReadyResearch(pipeline, readyResults)) return;
    this._setPhase(pipeline, 'phase-3-synthesis', '📋 Phase 3 — Senior Synthesis');
    const combined = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(profiles[seniorAgent]?.name || seniorAgent, 'research',
        this._phasePrompt(pipeline, 'Phase 3 — Synthesis',
          `Combine ONLY validation-ready research into one synthesis document. Do not use failed or NO_WEB_ACCESS content as factual evidence.\nRules:\n- Attribute findings to agents.\n- Every current factual claim must cite a URL.\n- Mark ✅ Confirmed when 2+ agents agree.\n- Mark ⚠️ Unverified when only 1 agent found it.\n- Highlight conflicts instead of hiding them.\n- Extract decision points for brainstorm.\n\nValidation-ready research submissions:\n${this._flagConfidence(readyResults)}`),
        sessionCtx.getSession(sessionId), profiles[seniorAgent]),
      { silent: true }
    );
    pipeline.combinedDoc = combined.content;
    this.emit('combined-doc-ready', { sessionId, combinedDoc: pipeline.combinedDoc });

    this._setPhase(pipeline, 'phase-4-brainstorm', '💭 Phase 4 — Structured Brainstorm');
    const discussResults = await this._runAllAgentsCapture(pipeline, (agentId, agentName) =>
      injectSkill(agentName, 'research',
        this._phasePrompt(pipeline, 'Phase 4 — Brainstorm Round 1',
          `Use this exact format:\nPosition: Agree / Disagree / Partially Agree\nEvidence: specific source or reasoning\nConfidence: X/10\n\nCombined research:\n${pipeline.combinedDoc}`),
        sessionCtx.getSession(sessionId), profiles[agentId])
    );

    this._setPhase(pipeline, 'phase-6-final', '📝 Phase 6 — Final Answer');
    const final = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(profiles[seniorAgent]?.name || seniorAgent, 'research',
        this._phasePrompt(pipeline, 'Phase 6 — Final Document',
          `Write final research document.\nInclude:\n- Answer to Boss task\n- Decisions / recommendations\n- Evidence with source attribution\n- Open risks and low-confidence items\n- Confidence: X/10 overall\n\nCombined research:\n${pipeline.combinedDoc}\n\nBrainstorm responses:\n${discussResults.map(r => r.agentName + ': ' + r.content).join('\n')}`),
        sessionCtx.getSession(sessionId), profiles[seniorAgent])
    );
    pipeline.finalAnswer = final.content;

    const c2 = await this._checkpoint(pipeline, { type: 'final-answer', message: '🔍 Mid Research Complete',
      description: 'Final answer ready.', buttons: ['Approve ✅', 'Send Back 🔄', 'Cancel ❌'] });
    if (c2 === 'approved') this.emit('pipeline-complete', { sessionId, finalAnswer: pipeline.finalAnswer });
  }

  // ── DEEP RESEARCH ──
  async _runDeepResearch(pipeline) {
    const { sessionId, task, seniorAgent } = pipeline;
    this._emitRoundHeader(sessionId, '🔬 Round 1 — Deep Independent Research');
    const results = await this._runAllAgentsCapture(pipeline, (agentId, agentName) =>
      injectSkill(agentName, 'deep', task, sessionCtx.getSession(sessionId), this._getProviderProfile(pipeline, agentId)),
      { silent: true }
    );
    results.forEach(r => { pipeline.researchData[r.agentId] = r.content; });
    const profiles = this._getProviderProfiles(pipeline);
    pipeline.researchValidation = this._validateResearchBatch(results, pipeline.researchPolicy, profiles);
    sessionCtx.updateSession(sessionId, { researchValidation: pipeline.researchValidation });
    this.emit('research-ready', { sessionId, researchData: pipeline.researchData, researchValidation: pipeline.researchValidation });
    const readyResults = this._readyResearchResults(results, pipeline.researchValidation);
    if (await this._stopIfNoReadyResearch(pipeline, readyResults)) return;

    const c1 = await this._checkpoint(pipeline, { type: 'research-complete', message: '🔬 Deep Research Complete',
      description: 'All agents submitted. Review Research Panel.',
      buttons: ['Approve Research ✅', 'Send Back 🔄', 'Cancel ❌'] });
    if (c1 === 'cancelled') return;

    this._emitRoundHeader(sessionId, '📋 Senior Agent Combining...');
    const combined = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(profiles[seniorAgent]?.name || seniorAgent, 'deep',
        `Combine ONLY validation-ready research into one synthesis document. Do not use failed or NO_WEB_ACCESS content as factual evidence. Every current factual claim must cite a source URL. Mark ✅ Confirmed when 2+ ready agents agree and ⚠️ Unverified when only 1 ready agent found it. Confidence 1-10 per finding.\n${this._flagConfidence(readyResults)}`,
        sessionCtx.getSession(sessionId), profiles[seniorAgent]),
      { silent: true }
    );
    pipeline.combinedDoc = combined.content;
    this.emit('combined-doc-ready', { sessionId, combinedDoc: pipeline.combinedDoc });

    // Brainstorm
    await this._runFullBrainstorm(pipeline);

    this._emitRoundHeader(sessionId, '📝 Writing Final Answer...');
    const brainstormSummary = pipeline.brainstormLog.map(r => `${r.agentName}: ${r.content}`).join('\n\n');
    const final = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(profiles[seniorAgent]?.name || seniorAgent, 'deep',
        `Write comprehensive final answer.\nTask: ${task}\nCOMBINED: ${pipeline.combinedDoc}\nBRAINSTORM: ${brainstormSummary}`,
        sessionCtx.getSession(sessionId), profiles[seniorAgent])
    );
    pipeline.finalAnswer = final.content;

    const c2 = await this._checkpoint(pipeline, { type: 'final-answer', message: '🔬 Deep Research Complete',
      description: 'Final answer ready.', buttons: ['Approve ✅', 'Send Back 🔄', 'Cancel ❌'] });
    if (c2 === 'approved') this.emit('pipeline-complete', { sessionId, finalAnswer: pipeline.finalAnswer });
  }

  // ── FULL BRAINSTORM (3 rounds) ──
  async _runFullBrainstorm(pipeline) {
    const { sessionId, task } = pipeline;
    const profiles = getAllProfiles();
    // Initialize the collaboration manager with this session
    collaborationManager.initBrainstorm(
      sessionId,
      pipeline.agents,
      pipeline.seniorAgent
    );
    // Forward collaboration events to pipeline listeners
    const forwardEvents = ['round-start', 'early-consensus', 'votes-ready', 'deadlock'];
    const handlers = {};
    forwardEvents.forEach(evt => {
      handlers[evt] = (data) => this.emit(evt, data);
      collaborationManager.on(evt, handlers[evt]);
    });
    try {
      const results = await collaborationManager.runFullBrainstorm({
        sessionId,
        combinedDoc: pipeline.combinedDoc || '',
        task,
      });
      pipeline.brainstormLog.push(...results);
      const voteAnalysis = collaborationManager.sessions[sessionId];
      if (voteAnalysis?.consensusReached) {
        this._emitSystem(sessionId, '✅ Team reached consensus.');
      }
      return results;
    } finally {
      // Clean up event listeners
      forwardEvents.forEach(evt => {
        collaborationManager.removeListener(evt, handlers[evt]);
      });
    }
  }

  // ── CODING ──
  async _runCoding(pipeline) {
    const { sessionId, task, seniorAgent } = pipeline;
    const profiles = getAllProfiles();
    const seniorName = profiles[seniorAgent]?.name || seniorAgent;

    this._setPhase(pipeline, 'phase-1-coding-preflight', '📐 Phase 1 — Coding Pre-flight');
    const planResult = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(seniorName, 'code',
        this._phasePrompt(pipeline, 'Coding Pre-flight',
          `Inspect the workspace before planning.\nReturn a concrete coding plan with:\n- Problem understanding\n- Files likely touched\n- Verification command(s)\n- Risks / assumptions\n- Confidence: X/10\n\nCoding task:\n${task}`),
        sessionCtx.getSession(sessionId))
    );
    const c1 = await this._checkpoint(pipeline, { type: 'plan-approval', message: '📐 Coding Plan Ready',
      description: `${seniorName} presented a plan.`, buttons: ['Approve Plan ✅', 'Revise Plan 🔄', 'Cancel ❌'] });
    if (c1 === 'cancelled') return;

    this._recordDecision(pipeline, `Coding plan approved for ${seniorName}`);
    this._setPhase(pipeline, 'phase-2-coding-execution', `💻 Phase 2 — ${seniorName} Coding`);
    await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(seniorName, 'code', this._phasePrompt(pipeline, 'Coding Execution',
        `Implement the approved plan directly in files.\nRules:\n- Keep changes surgical.\n- Do not touch unrelated files.\n- Run verification before reporting complete.\n\nApproved plan:\n${planResult.content}\n\nTask:\n${task}`), sessionCtx.getSession(sessionId))
    );

    this._setPhase(pipeline, 'phase-3-coding-summary', '📋 Phase 3 — Coding Summary');
    const summary = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(seniorName, 'code', this._phasePrompt(pipeline, 'Coding Summary',
        `Return this exact format:\n## What Was Built\n[brief description]\n\n## Decisions Followed\n- [approved plan / decisions]\n\n## Deviations\n- [any deviations + why, or None]\n\n## Issues Encountered\n- [blockers/problems, or None]\n\n## Verification\n- [commands run and result]\n\n## Confidence\nX/10 — [reason]\n\nEnd with [CODE DONE]`), sessionCtx.getSession(sessionId))
    );
    pipeline.finalAnswer = summary.content;

    const c2 = await this._checkpoint(pipeline, { type: 'code-complete', message: '💻 Code Complete',
      description: `${seniorName} finished coding.`, buttons: ['Approve Code ✅', 'Review Code 👁️', 'Cancel ❌'] });
    if (c2 === 'approved') this.emit('pipeline-complete', { sessionId, finalAnswer: pipeline.finalAnswer });
  }

  // ── CODE REVIEW ──
  async _runCodeReview(pipeline) {
    const { sessionId, task } = pipeline;
    this._emitRoundHeader(sessionId, '👁️ Code Review');
    const results = await this._runAllAgentsCapture(pipeline, (agentId, agentName, profile) =>
      injectSkill(agentName, 'review', task, sessionCtx.getSession(sessionId), profile)
    );
    pipeline.finalAnswer = results.map(r => `${r.agentName}:\n${r.content}`).join('\n\n');
    const c = await this._checkpoint(pipeline, { type: 'review-complete', message: '👁️ Code Review Complete',
      buttons: ['Approve ✅', 'Send Back 🔄', 'Cancel ❌'] });
    if (c === 'approved') this.emit('pipeline-complete', { sessionId, finalAnswer: pipeline.finalAnswer });
  }

  // ── DEBUGGING ──
  async _runDebugging(pipeline) {
    const { sessionId, task, seniorAgent } = pipeline;
    this._emitRoundHeader(sessionId, '🐛 All Agents Diagnosing');
    const results = await this._runAllAgentsCapture(pipeline, (agentId, agentName, profile) =>
      injectSkill(agentName, 'debug', task, sessionCtx.getSession(sessionId), profile)
    );
    const c1 = await this._checkpoint(pipeline, { type: 'diagnosis-complete', message: '🐛 Diagnosis Ready',
      buttons: ['Approve Diagnosis ✅', 'Send Back 🔄', 'Cancel ❌'] });
    if (c1 === 'cancelled') return;

    const seniorProfile = this._getProviderProfile(pipeline, seniorAgent);
    const seniorName = seniorProfile?.name || seniorAgent;
    this._emitRoundHeader(sessionId, `🔧 ${seniorName} Applying Fix...`);
    const fix = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(seniorName, 'debug',
        `Apply best fix.\nTask: ${task}\nDIAGNOSES:\n${results.map(r => `${r.agentName}: ${r.content}`).join('\n\n')}`,
        sessionCtx.getSession(sessionId), seniorProfile)
    );
    pipeline.finalAnswer = fix.content;
    const c2 = await this._checkpoint(pipeline, { type: 'fix-complete', message: '🔧 Fix Applied',
      buttons: ['Approve Fix ✅', 'Try Again 🔄', 'Cancel ❌'] });
    if (c2 === 'approved') this.emit('pipeline-complete', { sessionId, finalAnswer: pipeline.finalAnswer });
  }

  // ── PLANNING ──
  async _runPlanning(pipeline) {
    const { sessionId, task, seniorAgent } = pipeline;
    this._emitRoundHeader(sessionId, '📐 Round 1 — Independent Planning');
    const results = await this._runAllAgentsCapture(pipeline, (agentId, agentName, profile) =>
      injectSkill(agentName, 'plan', task, sessionCtx.getSession(sessionId), profile)
    );
    const c1 = await this._checkpoint(pipeline, { type: 'plans-ready', message: '📐 All Plans Submitted',
      buttons: ['Start Brainstorm 🧠', 'Skip to Final ⏭️', 'Cancel ❌'] });
    if (c1 === 'cancelled') return;
    if (c1 !== 'skip') await this._runFullBrainstorm(pipeline);

    const seniorProfile = this._getProviderProfile(pipeline, seniorAgent);
    const seniorName = seniorProfile?.name || seniorAgent;
    this._emitRoundHeader(sessionId, '📐 Writing Final Plan...');
    const final = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(seniorName, 'plan',
        `Write final plan. Be specific.\nPLANS: ${results.map(r => `${r.agentName}: ${r.content}`).join('\n')}\nDISCUSSION: ${pipeline.brainstormLog.map(r => `${r.agentName}: ${r.content}`).join('\n')}`,
        sessionCtx.getSession(sessionId), seniorProfile)
    );
    pipeline.finalAnswer = final.content;
    const c2 = await this._checkpoint(pipeline, { type: 'final-answer', message: '📐 Final Plan Ready',
      buttons: ['Approve Plan ✅', 'Send Back 🔄', 'Cancel ❌'] });
    if (c2 === 'approved') this.emit('pipeline-complete', { sessionId, finalAnswer: pipeline.finalAnswer });
  }

  // ── TESTING ──
  async _runTesting(pipeline) {
    const { sessionId, task, seniorAgent } = pipeline;
    this._emitRoundHeader(sessionId, '🧪 Writing Tests...');
    const seniorProfile = this._getProviderProfile(pipeline, seniorAgent);
    const result = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(seniorProfile?.name || seniorAgent, 'test', task, sessionCtx.getSession(sessionId), seniorProfile)
    );
    pipeline.finalAnswer = result.content;
    const c = await this._checkpoint(pipeline, { type: 'tests-complete', message: '🧪 Tests Written',
      buttons: ['Approve ✅', 'Send Back 🔄', 'Cancel ❌'] });
    if (c === 'approved') this.emit('pipeline-complete', { sessionId, finalAnswer: pipeline.finalAnswer });
  }

  // ── APP TESTING ──
  async _runAppTesting(pipeline) {
    const { sessionId, task } = pipeline;
    const profiles = this._getProviderProfiles(pipeline);
    const browserAgents = pipeline.agents.filter(id => profiles[id]?.hasBrowser);
    if (browserAgents.length === 0) { this._emitSystem(sessionId, '⚠️ No browser-capable agents.'); return; }
    this._emitRoundHeader(sessionId, '📱 App Testing');
    const results = await Promise.all(browserAgents.map(agentId =>
      this._runAgentCapture(pipeline, agentId,
        injectSkill(profiles[agentId].name, 'apptest', task, sessionCtx.getSession(sessionId), profiles[agentId]))
    ));
    pipeline.finalAnswer = results.map(r => `${r.agentName}:\n${r.content}`).join('\n\n');
    const c = await this._checkpoint(pipeline, { type: 'apptest-complete', message: '📱 App Testing Complete',
      buttons: ['Approve ✅', 'Run Again 🔄', 'Cancel ❌'] });
    if (c === 'approved') this.emit('pipeline-complete', { sessionId, finalAnswer: pipeline.finalAnswer });
  }

  // ── DOCUMENT ──
  async _runDocument(pipeline) {
    const { sessionId, task, seniorAgent } = pipeline;
    const seniorProfile = this._getProviderProfile(pipeline, seniorAgent);
    const result = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(seniorProfile?.name || seniorAgent, 'doc', task, sessionCtx.getSession(sessionId), seniorProfile)
    );
    pipeline.finalAnswer = result.content;
    const c = await this._checkpoint(pipeline, { type: 'doc-complete', message: '📄 Document Complete',
      buttons: ['Approve ✅', 'Send Back 🔄', 'Cancel ❌'] });
    if (c === 'approved') this.emit('pipeline-complete', { sessionId, finalAnswer: pipeline.finalAnswer });
  }

  // ── TEAM CODING ──
  async _runTeamCoding(pipeline) {
    const { sessionId, task, seniorAgent } = pipeline;
    const profiles   = this._getProviderProfiles(pipeline);
    const seniorProfile = profiles[seniorAgent];
    const seniorName = seniorProfile?.name || seniorAgent;

    // ── Phase 1: Architecture Planning ───────────────────────────────────────
    this._emitRoundHeader(sessionId, '👥 Team Coding — Phase 1: Architecture Planning');
    this._emitSystem(sessionId,
      '🗓️ All agents are discussing architecture. No code yet — planning only.'
    );

    const planResults = await this._runAllAgentsCapture(pipeline,
      (agentId, agentName, profile) => injectSkill(agentName, 'teamcode',
        `PLANNING PHASE — Do NOT write any code yet.

Discuss the architecture for this task: ${task}

Your job in this planning phase:
1. Propose which tech stack and libraries to use
2. Suggest a folder structure
3. Based on your strengths, propose which part you should own:
   - Claude Code is best at: complex logic, architecture, main process
   - Codex is best at: feature implementation, state management, functions
   - Gemini CLI is best at: UI components, styling, large context reading
4. Define what interfaces/APIs your part will expose to the others

Keep your response focused and specific. Max 250 words.`,
        sessionCtx.getSession(sessionId), profile
      )
    );

    // Senior Agent creates the division of work
    const planSummary = planResults
      .map(r => `${r.agentName}:\n${r.content}`)
      .join('\n\n---\n\n');

    this._emitSystem(sessionId, `📋 ${seniorName} is creating the final work division...`);

    const divisionResult = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(seniorName, 'teamcode',
        `Based on the team planning discussion below, create the FINAL division of work.

Rules:
- Each agent gets specific files/folders they OWN. No overlapping.
- Define the interface contracts — exactly how each piece connects to the others.
- Be specific about file paths.

Format your response as:
ASSIGNED TO [agent name]:
- Files: [specific file paths]
- Responsibility: [what they build]
- Exposes: [functions/APIs other agents can use from their code]

INTERFACE CONTRACTS:
[define exactly how the pieces connect]

PLANNING DISCUSSION:
${planSummary}`,
        sessionCtx.getSession(sessionId), seniorProfile
      )
    );

    // Checkpoint — Boss approves the division before coding starts
    const c1 = await this._checkpoint(pipeline, {
      type:        'team-division-ready',
      message:     '👥 Work Division Ready',
      description: `${seniorName} has divided the project. Review the plan above and approve to start coding.`,
      buttons:     ['Approve — Start Coding ✅', 'Revise Division 🔄', 'Cancel ❌'],
    });
    if (c1 === 'cancelled') return;
    if (c1 === 'sendback' || (c1?.action === 'sendback') || c1 === 'Revise Division 🔄') {
      const reason = c1?.reason || 'Please revise the work division.';
      pipeline.sendBackCount = (pipeline.sendBackCount || 0) + 1;
      if (pipeline.sendBackCount >= 3) {
        this._emitSystem(sessionId, '⚠️ Maximum revisions reached. Please approve or cancel.');
        return;
      }
      this._emitSystem(sessionId, `🔄 Boss requested revision: ${reason}`);
      const replanResult = await this._runAgentCapture(pipeline, seniorAgent,
        injectSkill(seniorName, 'teamcode',
          `REVISION REQUEST from Boss:\n${reason}\n\nYour previous division:\n${divisionResult.content}\n\nRevise and resubmit the work division only.`,
          sessionCtx.getSession(sessionId), seniorProfile)
      );
      divisionResult.content = replanResult.content;
      const c1Retry = await this._checkpoint(pipeline, {
        type: 'team-division-ready',
        message: '👥 Revised Work Division Ready',
        description: 'Boss requested a revision. Review the updated plan.',
        buttons: ['Approve — Start Coding ✅', 'Revise Division 🔄', 'Cancel ❌'],
      });
      if (c1Retry === 'cancelled') return;
    }

    // ── Phase 2: Parallel Coding ──────────────────────────────────────────────
    this._emitRoundHeader(sessionId, '👥 Team Coding — Phase 2: Parallel Coding');
    this._emitSystem(sessionId,
      '⚡ All agents coding their assigned parts simultaneously. This may take a while...'
    );

    const division = divisionResult.content;

    const codeResults = await this._runAllAgentsCapture(pipeline,
      (agentId, agentName, profile) => injectSkill(agentName, 'teamcode',
        `CODING PHASE — Now write your assigned code.

Read your assignment from the work division below.
Find the section "ASSIGNED TO ${agentName}" and code exactly that.

STRICT RULES:
- Only create and edit files assigned to YOU
- Do NOT touch files assigned to other agents
- Follow the interface contracts exactly — other agents depend on them
- Save all your files to: ${pipeline.workDir || '~/no1team/workspace'}
- Write clean, commented code
- When you finish ALL your files, write a brief summary:
  FILES CREATED: [list]
  INTERFACES EXPOSED: [list of functions/exports]
  NOTES FOR TEAM: [anything other agents need to know]
- End with: [MY PART DONE]

WORK DIVISION:
${division}

TASK:
${task}`,
        sessionCtx.getSession(sessionId), profile
      )
    );

    // ── Phase 3: Integration ──────────────────────────────────────────────────
    this._emitRoundHeader(sessionId, '👥 Team Coding — Phase 3: Integration');
    this._emitSystem(sessionId,
      `🔗 ${seniorName} is integrating all parts into a working whole...`
    );

    const codeSummaries = codeResults
      .map(r => `${r.agentName}:\n${r.content}`)
      .join('\n\n---\n\n');

    const integrationResult = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(seniorName, 'teamcode',
        `INTEGRATION PHASE — Integrate all coded parts into a working whole.

Your job:
1. Read each agent's summary to understand what they built
2. Connect the pieces — make sure imports/exports match the interface contracts
3. Fix any connection issues between the parts
4. Write a final integration summary:
   - What the complete system does
   - How to run it
   - Any known issues or limitations

End with: [INTEGRATION DONE]

WHAT EACH AGENT BUILT:
${codeSummaries}

ORIGINAL WORK DIVISION (interface contracts):
${division}`,
        sessionCtx.getSession(sessionId), seniorProfile
      )
    );

    pipeline.finalAnswer = integrationResult.content;

    // Final checkpoint with code review option
    const c2 = await this._checkpoint(pipeline, {
      type:        'team-code-complete',
      message:     '👥 Team Coding Complete',
      description: 'Integration finished. All parts combined. Review the summary above.',
      buttons:     ['Approve ✅', 'Review Code 👁️', 'Send Back 🔄', 'Cancel ❌'],
    });

    if (c2 === 'review' || c2 === 'Review Code 👁️') {
      // Run code review phase
      await this._runCodeReview(pipeline);
    } else if (c2 === 'approved' || c2 === 'Approve ✅') {
      this.emit('pipeline-complete', { sessionId, finalAnswer: pipeline.finalAnswer });
    } else if (c2?.action === 'sendback' || c2 === 'Send Back 🔄') {
      const reason = c2?.reason || 'Please improve the final integration and fix any issues.';
      this._emitSystem(sessionId, `🔄 Boss requested revision of integrated code: ${reason}`);
      // Restart integration phase with feedback
      await this._runTeamCoding(pipeline);
    }
  }

  // ── BRAINSTORM CHAT ──
  async _runBrainstormChat(pipeline) {
    this.emit('brainstorm-mode-active', { sessionId: pipeline.sessionId });
    this._emitSystem(pipeline.sessionId, '💬 Brainstorm Chat active. Tag agents with @Name.');
  }

  // ── GENERAL ──
  async _runGeneral(pipeline) {
    const { sessionId, task } = pipeline;
    await this._runAllAgentsCapture(pipeline, (agentId, agentName) =>
      `You are ${agentName}, a concise member of No. 1 Team. Answer the Boss directly.\n\nBoss message:\n${task}`
    );
    this.emit('pipeline-complete', { sessionId, finalAnswer: null });
  }
}

module.exports = new PipelineManager();
