// pipelineManager.js
// Controls the full task pipeline for each task type

const { EventEmitter } = require('events');
const agentRunner      = require('./agentRunner');
const { injectSkill }  = require('./skillBuilder');
const { getAllProfiles } = require('./providerProfiles');
const sessionCtx       = require('./sessionContext');

class PipelineManager extends EventEmitter {
  constructor() {
    super();
    this.pipelines = {};
  }

  async startPipeline({ sessionId, taskType, task, agents, models, workDir, mode, seniorAgent }) {
    const pipeline = {
      sessionId, taskType, task, agents, models, workDir, mode, seniorAgent,
      phase: 'start', researchData: {}, combinedDoc: null,
      brainstormLog: [], finalAnswer: null, sendBackCount: 0, waitingForBoss: false,
    };
    this.pipelines[sessionId] = pipeline;
    sessionCtx.updateSession(sessionId, { taskType, seniorAgent, phase: 'start' });
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
      if (pipeline.mode === 'auto') {
        this.emit('auto-approved', { sessionId: pipeline.sessionId, message: checkpointData.message });
        resolve('approved');
        return;
      }
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
      const onChunk = (data) => {
        if (data.sessionId === pipeline.sessionId && data.agentId === agentId) fullResponse += data.content;
      };
      const onDone = (data) => {
        if (data.sessionId === pipeline.sessionId && data.agentId === agentId) {
          agentRunner.removeListener('agent-chunk', onChunk);
          agentRunner.removeListener('agent-done', onDone);
          resolve({ agentId, agentName, content: fullResponse.trim() });
        }
      };
      agentRunner.on('agent-chunk', onChunk);
      agentRunner.on('agent-done', onDone);
      agentRunner.sendToAgent({ task: prompt, workDir: pipeline.workDir, agent: agentId,
        model: pipeline.models[agentId], sessionId: pipeline.sessionId, silent: options.silent });
    });
  }

  _runAllAgentsCapture(pipeline, buildPrompt, options = {}) {
    return Promise.all(pipeline.agents.map(agentId => {
      const profiles = getAllProfiles();
      const prompt = buildPrompt(agentId, profiles[agentId]?.name || agentId);
      return this._runAgentCapture(pipeline, agentId, prompt, options);
    }));
  }

  _flagConfidence(results) {
    return results.map(r => `\n=== ${r.agentName} ===\n${r.content}\n`).join('\n');
  }

  _emitRoundHeader(sessionId, label) { this.emit('round-header', { sessionId, label }); }
  _emitSystem(sessionId, message) { this.emit('system-message', { sessionId, message }); }

  // ── QUICK RESEARCH ──
  async _runQuickResearch(pipeline) {
    const { sessionId, task, seniorAgent } = pipeline;
    this._emitRoundHeader(sessionId, '⚡ Quick Research — Starting');
    const results = await this._runAllAgentsCapture(pipeline, (agentId, agentName) =>
      injectSkill(agentName, 'quick', task, sessionCtx.getSession(sessionId)),
      { silent: true }
    );
    results.forEach(r => { pipeline.researchData[r.agentId] = r.content; });
    this.emit('research-ready', { sessionId, researchData: pipeline.researchData });

    this._emitRoundHeader(sessionId, '📋 Combining Results...');
    const final = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(getAllProfiles()[seniorAgent]?.name || seniorAgent, 'quick',
        `Combine these research results into one clean bullet-point summary.\n${this._flagConfidence(results)}`,
        sessionCtx.getSession(sessionId)),
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
    const { sessionId, task, seniorAgent } = pipeline;
    this._emitRoundHeader(sessionId, '🔍 Round 1 — Independent Research');
    const results = await this._runAllAgentsCapture(pipeline, (agentId, agentName) =>
      injectSkill(agentName, 'research', task, sessionCtx.getSession(sessionId)),
      { silent: true }
    );
    results.forEach(r => { pipeline.researchData[r.agentId] = r.content; });
    this.emit('research-ready', { sessionId, researchData: pipeline.researchData });

    const c1 = await this._checkpoint(pipeline, { type: 'research-complete', message: '🔍 Research Complete',
      description: 'All agents submitted research. Review Research Panel.',
      buttons: ['Approve Research ✅', 'Send Back 🔄', 'Cancel ❌'] });
    if (c1 === 'cancelled') return;

    this._emitRoundHeader(sessionId, '📋 Combining Research...');
    const combined = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(getAllProfiles()[seniorAgent]?.name || seniorAgent, 'research',
        `Combine all research. Mark: ✅ Confirmed (2+ agents), ⚠️ Unverified (1 agent).\n${this._flagConfidence(results)}`,
        sessionCtx.getSession(sessionId)),
      { silent: true }
    );
    pipeline.combinedDoc = combined.content;
    this.emit('combined-doc-ready', { sessionId, combinedDoc: pipeline.combinedDoc });

    this._emitRoundHeader(sessionId, '💭 Round 2 — Team Discussion');
    const discussResults = await this._runAllAgentsCapture(pipeline, (agentId, agentName) =>
      injectSkill(agentName, 'research',
        `Read the combined research and add your perspective. Under 150 words.\nCOMBINED:\n${pipeline.combinedDoc}`,
        sessionCtx.getSession(sessionId))
    );

    this._emitRoundHeader(sessionId, '📝 Writing Final Answer...');
    const final = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(getAllProfiles()[seniorAgent]?.name || seniorAgent, 'research',
        `Write the final research answer. Under 500 words.\nCOMBINED: ${pipeline.combinedDoc}\nDISCUSSION: ${discussResults.map(r => r.agentName + ': ' + r.content).join('\n')}`,
        sessionCtx.getSession(sessionId))
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
      injectSkill(agentName, 'deep', task, sessionCtx.getSession(sessionId)),
      { silent: true }
    );
    results.forEach(r => { pipeline.researchData[r.agentId] = r.content; });
    this.emit('research-ready', { sessionId, researchData: pipeline.researchData });

    const c1 = await this._checkpoint(pipeline, { type: 'research-complete', message: '🔬 Deep Research Complete',
      description: 'All agents submitted. Review Research Panel.',
      buttons: ['Approve Research ✅', 'Send Back 🔄', 'Cancel ❌'] });
    if (c1 === 'cancelled') return;

    this._emitRoundHeader(sessionId, '📋 Senior Agent Combining...');
    const combined = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(getAllProfiles()[seniorAgent]?.name || seniorAgent, 'deep',
        `Combine all research. ✅ Confirmed (2+ agents), ⚠️ Unverified (1 agent). Confidence 1-10 per finding.\n${this._flagConfidence(results)}`,
        sessionCtx.getSession(sessionId)),
      { silent: true }
    );
    pipeline.combinedDoc = combined.content;
    this.emit('combined-doc-ready', { sessionId, combinedDoc: pipeline.combinedDoc });

    // Brainstorm
    await this._runFullBrainstorm(pipeline);

    this._emitRoundHeader(sessionId, '📝 Writing Final Answer...');
    const brainstormSummary = pipeline.brainstormLog.map(r => `${r.agentName}: ${r.content}`).join('\n\n');
    const final = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(getAllProfiles()[seniorAgent]?.name || seniorAgent, 'deep',
        `Write comprehensive final answer.\nTask: ${task}\nCOMBINED: ${pipeline.combinedDoc}\nBRAINSTORM: ${brainstormSummary}`,
        sessionCtx.getSession(sessionId))
    );
    pipeline.finalAnswer = final.content;

    const c2 = await this._checkpoint(pipeline, { type: 'final-answer', message: '🔬 Deep Research Complete',
      description: 'Final answer ready.', buttons: ['Approve ✅', 'Send Back 🔄', 'Cancel ❌'] });
    if (c2 === 'approved') this.emit('pipeline-complete', { sessionId, finalAnswer: pipeline.finalAnswer });
  }

  // ── FULL BRAINSTORM (3 rounds) ──
  async _runFullBrainstorm(pipeline) {
    const { sessionId } = pipeline;

    this._emitRoundHeader(sessionId, '🧠 Brainstorm — Turn 1: Positions');
    const turn1 = await this._runAllAgentsCapture(pipeline, (agentId, agentName) =>
      injectSkill(agentName, 'deep',
        `State your position based on the combined research. Max 200 words.\nRESEARCH: ${pipeline.combinedDoc}`,
        sessionCtx.getSession(sessionId))
    );
    pipeline.brainstormLog.push(...turn1);

    const hasDisagreement = turn1.map(r => r.content).join(' ').toLowerCase().match(/disagree|however|but |actually/);
    if (!hasDisagreement) { this._emitSystem(sessionId, '✅ Early consensus reached.'); return; }

    this._emitRoundHeader(sessionId, '🧠 Brainstorm — Turn 2: Challenges');
    const turn1Summary = turn1.map(r => `${r.agentName}: ${r.content}`).join('\n\n');
    const turn2 = await this._runAllAgentsCapture(pipeline, (agentId, agentName) =>
      injectSkill(agentName, 'deep',
        `Challenge the weakest point from each teammate. Max 200 words.\nPOSITIONS:\n${turn1Summary}`,
        sessionCtx.getSession(sessionId))
    );
    pipeline.brainstormLog.push(...turn2);

    this._emitRoundHeader(sessionId, '🧠 Brainstorm — Turn 3: Evidence Vote');
    const allSoFar = [...turn1, ...turn2].map(r => `${r.agentName}: ${r.content}`).join('\n\n');
    const turn3 = await this._runAllAgentsCapture(pipeline, (agentId, agentName) =>
      injectSkill(agentName, 'deep',
        `Cast your evidence vote. VOTE: [your answer]. One sentence why.\nDEBATE:\n${allSoFar}`,
        sessionCtx.getSession(sessionId))
    );
    pipeline.brainstormLog.push(...turn3);
    this.emit('brainstorm-votes', { sessionId, votes: turn3.map(r => r.content) });
  }

  // ── CODING ──
  async _runCoding(pipeline) {
    const { sessionId, task, seniorAgent } = pipeline;
    const profiles = getAllProfiles();
    const seniorName = profiles[seniorAgent]?.name || seniorAgent;

    this._emitRoundHeader(sessionId, '📐 Coding Plan');
    const planResult = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(seniorName, 'code',
        `Present a coding plan for: ${task}\nInclude approach, files, tools. Under 300 words.`,
        sessionCtx.getSession(sessionId))
    );
    const c1 = await this._checkpoint(pipeline, { type: 'plan-approval', message: '📐 Coding Plan Ready',
      description: `${seniorName} presented a plan.`, buttons: ['Approve Plan ✅', 'Revise Plan 🔄', 'Cancel ❌'] });
    if (c1 === 'cancelled') return;

    this._emitRoundHeader(sessionId, `💻 ${seniorName} is coding...`);
    await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(seniorName, 'code', `Write the code. Plan: ${planResult.content}\nTask: ${task}`, sessionCtx.getSession(sessionId))
    );

    this._emitRoundHeader(sessionId, '📋 Code Summary');
    const summary = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(seniorName, 'code', `Write a code summary. Files, purpose, how to run. End with [CODE DONE]`, sessionCtx.getSession(sessionId))
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
    const results = await this._runAllAgentsCapture(pipeline, (agentId, agentName) =>
      injectSkill(agentName, 'review', task, sessionCtx.getSession(sessionId))
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
    const results = await this._runAllAgentsCapture(pipeline, (agentId, agentName) =>
      injectSkill(agentName, 'debug', task, sessionCtx.getSession(sessionId))
    );
    const c1 = await this._checkpoint(pipeline, { type: 'diagnosis-complete', message: '🐛 Diagnosis Ready',
      buttons: ['Approve Diagnosis ✅', 'Send Back 🔄', 'Cancel ❌'] });
    if (c1 === 'cancelled') return;

    const seniorName = getAllProfiles()[seniorAgent]?.name || seniorAgent;
    this._emitRoundHeader(sessionId, `🔧 ${seniorName} Applying Fix...`);
    const fix = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(seniorName, 'debug',
        `Apply best fix.\nTask: ${task}\nDIAGNOSES:\n${results.map(r => `${r.agentName}: ${r.content}`).join('\n\n')}`,
        sessionCtx.getSession(sessionId))
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
    const results = await this._runAllAgentsCapture(pipeline, (agentId, agentName) =>
      injectSkill(agentName, 'plan', task, sessionCtx.getSession(sessionId))
    );
    const c1 = await this._checkpoint(pipeline, { type: 'plans-ready', message: '📐 All Plans Submitted',
      buttons: ['Start Brainstorm 🧠', 'Skip to Final ⏭️', 'Cancel ❌'] });
    if (c1 === 'cancelled') return;
    if (c1 !== 'skip') await this._runFullBrainstorm(pipeline);

    const seniorName = getAllProfiles()[seniorAgent]?.name || seniorAgent;
    this._emitRoundHeader(sessionId, '📐 Writing Final Plan...');
    const final = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(seniorName, 'plan',
        `Write final plan. Be specific.\nPLANS: ${results.map(r => `${r.agentName}: ${r.content}`).join('\n')}\nDISCUSSION: ${pipeline.brainstormLog.map(r => `${r.agentName}: ${r.content}`).join('\n')}`,
        sessionCtx.getSession(sessionId))
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
    const result = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(getAllProfiles()[seniorAgent]?.name || seniorAgent, 'test', task, sessionCtx.getSession(sessionId))
    );
    pipeline.finalAnswer = result.content;
    const c = await this._checkpoint(pipeline, { type: 'tests-complete', message: '🧪 Tests Written',
      buttons: ['Approve ✅', 'Send Back 🔄', 'Cancel ❌'] });
    if (c === 'approved') this.emit('pipeline-complete', { sessionId, finalAnswer: pipeline.finalAnswer });
  }

  // ── APP TESTING ──
  async _runAppTesting(pipeline) {
    const { sessionId, task } = pipeline;
    const profiles = getAllProfiles();
    const browserAgents = pipeline.agents.filter(id => profiles[id]?.hasBrowser);
    if (browserAgents.length === 0) { this._emitSystem(sessionId, '⚠️ No browser-capable agents.'); return; }
    this._emitRoundHeader(sessionId, '📱 App Testing');
    const results = await Promise.all(browserAgents.map(agentId =>
      this._runAgentCapture(pipeline, agentId,
        injectSkill(profiles[agentId].name, 'apptest', task, sessionCtx.getSession(sessionId)))
    ));
    pipeline.finalAnswer = results.map(r => `${r.agentName}:\n${r.content}`).join('\n\n');
    const c = await this._checkpoint(pipeline, { type: 'apptest-complete', message: '📱 App Testing Complete',
      buttons: ['Approve ✅', 'Run Again 🔄', 'Cancel ❌'] });
    if (c === 'approved') this.emit('pipeline-complete', { sessionId, finalAnswer: pipeline.finalAnswer });
  }

  // ── DOCUMENT ──
  async _runDocument(pipeline) {
    const { sessionId, task, seniorAgent } = pipeline;
    const result = await this._runAgentCapture(pipeline, seniorAgent,
      injectSkill(getAllProfiles()[seniorAgent]?.name || seniorAgent, 'doc', task, sessionCtx.getSession(sessionId))
    );
    pipeline.finalAnswer = result.content;
    const c = await this._checkpoint(pipeline, { type: 'doc-complete', message: '📄 Document Complete',
      buttons: ['Approve ✅', 'Send Back 🔄', 'Cancel ❌'] });
    if (c === 'approved') this.emit('pipeline-complete', { sessionId, finalAnswer: pipeline.finalAnswer });
  }

  // ── TEAM CODING ──
  async _runTeamCoding(pipeline) {
    const { sessionId, task, seniorAgent } = pipeline;
    const profiles   = getAllProfiles();
    const seniorName = profiles[seniorAgent]?.name || seniorAgent;

    // ── Phase 1: Architecture Planning ───────────────────────────────────────
    this._emitRoundHeader(sessionId, '👥 Team Coding — Phase 1: Architecture Planning');
    this._emitSystem(sessionId,
      '🗓️ All agents are discussing architecture. No code yet — planning only.'
    );

    const planResults = await this._runAllAgentsCapture(pipeline,
      (agentId, agentName) => injectSkill(agentName, 'teamcode',
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
        sessionCtx.getSession(sessionId)
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
        sessionCtx.getSession(sessionId)
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
    if (c1 === 'sendback' || c1 === 'Revise Division 🔄') {
      this._emitSystem(sessionId, '🔄 Revising work division...');
      await this._runTeamCoding(pipeline); // restart planning
      return;
    }

    // ── Phase 2: Parallel Coding ──────────────────────────────────────────────
    this._emitRoundHeader(sessionId, '👥 Team Coding — Phase 2: Parallel Coding');
    this._emitSystem(sessionId,
      '⚡ All agents coding their assigned parts simultaneously. This may take a while...'
    );

    const division = divisionResult.content;

    const codeResults = await this._runAllAgentsCapture(pipeline,
      (agentId, agentName) => injectSkill(agentName, 'teamcode',
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
        sessionCtx.getSession(sessionId)
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
        sessionCtx.getSession(sessionId)
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
      await this._runCodeReviewPhase(pipeline, '', pipeline.finalAnswer);
    } else if (c2 === 'approved' || c2 === 'Approve ✅') {
      this.emit('pipeline-complete', { sessionId, finalAnswer: pipeline.finalAnswer });
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
      injectSkill(agentName, 'general', task, sessionCtx.getSession(sessionId))
    );
    this.emit('pipeline-complete', { sessionId, finalAnswer: null });
  }
}

module.exports = new PipelineManager();
