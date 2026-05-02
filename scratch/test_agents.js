const path = require('path');
const runner = require('../src/main/agentRunner.js');

function runTest(agentId) {
  return new Promise((resolve) => {
    console.log(`\n========================================`);
    console.log(`🧪 TESTING AGENT: ${agentId}`);
    console.log(`========================================`);
    
    let chunkCount = 0;
    
    // Attach listeners
    runner.on('agent-chunk', (data) => {
      if (data.agentId === agentId) {
        chunkCount++;
        console.log(`[UI CHUNK EVENT] ${data.content}`);
      }
    });

    runner.on('agent-error', (data) => {
      if (data.agentId === agentId) {
        console.log(`[UI ERROR EVENT] Type: ${data.type || 'generic'} | Msg: ${data.error}`);
      }
    });

    runner.on('agent-done', (data) => {
      if (data.agentId === agentId) {
        console.log(`[UI DONE EVENT] Exit code: ${data.exitCode} | Total chunks: ${chunkCount}`);
        resolve();
      }
    });

    // Run the agent
    console.log(`> Sending task to ${agentId}...`);
    const proc = runner.runAgent(agentId, "What is 2+2? Answer in one word.", null, process.cwd(), 'test-sess');
    
    if (!proc) {
      console.log(`❌ Failed to spawn ${agentId}`);
      resolve();
      return;
    }

    // Capture raw stderr to see what the terminal would see
    proc.stderr.on('data', (d) => {
      console.log(`[RAW STDERR] ${d.toString().trim()}`);
    });
  });
}

async function main() {
  await runTest('claude');
  await runTest('codex');
  await runTest('gemini');
  console.log(`\n✅ ALL TESTS FINISHED.`);
  process.exit(0);
}

main();
