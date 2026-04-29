// analyticsManager.js — Reads Brain memory and produces analytics data

const brainMemory = require('./brainMemory');
const { getAllProfiles } = require('./providerProfiles');

function getAnalytics() {
  const sessions = brainMemory.listSessions();
  const totalSessions = sessions.length;
  const approved = sessions.filter(s => s.status?.includes('✅')).length;
  const sentBack = sessions.filter(s => s.status?.includes('🔄')).length;
  const cancelled = sessions.filter(s => s.status?.includes('❌')).length;

  const taskBreakdown = {};
  sessions.forEach(s => {
    const type = s.taskType || 'general';
    taskBreakdown[type] = (taskBreakdown[type] || 0) + 1;
  });

  const profiles = getAllProfiles();
  const agentStats = {};
  Object.keys(profiles).forEach(agentId => {
    const content = brainMemory.readFile(`agents/${agentId}.md`);
    if (!content) return;
    const lines = content.split('\n').filter(l => l.includes('✅') || l.includes('🔄'));
    const total = lines.length;
    const approvedCount = lines.filter(l => l.includes('✅')).length;
    const sendBacks = lines.reduce((acc, l) => {
      const m = l.match(/Send-backs: (\d+)/);
      return acc + (m ? parseInt(m[1]) : 0);
    }, 0);
    if (total > 0) {
      agentStats[agentId] = {
        name: profiles[agentId].name, color: profiles[agentId].color,
        total, approved: approvedCount,
        approvalRate: Math.round((approvedCount / total) * 100),
        avgSendBacks: (sendBacks / total).toFixed(1),
      };
    }
  });

  const skillStats = brainMemory.getSkillStats();
  const recentSessions = sessions.slice(0, 5);

  return {
    overview: { totalSessions, approved, sentBack, cancelled,
      approvalRate: totalSessions > 0 ? Math.round((approved / totalSessions) * 100) : 0 },
    taskBreakdown, agentStats, skillStats, recentSessions,
  };
}

module.exports = { getAnalytics };
