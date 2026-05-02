import React, { useState } from 'react';

const AGENT_COLORS = {
  claude:    '#F07830',
  codex:     '#9B9BA8',
  gemini:    '#5B9CF6',
  aider:     '#52C97A',
  opencode:  '#F472B6',
};

const AGENT_NAMES = {
  claude:    'Claude Code',
  codex:     'Codex',
  gemini:    'Gemini CLI',
  aider:     'Aider',
  opencode:  'OpenCode',
};

const STATUS_STYLES = {
  ready:   { label: 'READY', color: '#52C97A' },
  warning: { label: 'WARNING', color: '#FACC15' },
  blocked: { label: 'NO WEB', color: '#F97316' },
  failed:  { label: 'FAILED', color: '#EF4444' },
};

function ValidationBadge({ status }) {
  if (!status) return null;
  const style = STATUS_STYLES[status] || STATUS_STYLES.failed;
  return (
    <span style={{
      color: style.color,
      border: `1px solid ${style.color}`,
      borderRadius: 999,
      padding: '2px 6px',
      fontSize: 10,
      fontWeight: 700,
    }}>
      {style.label}
    </span>
  );
}

export default function ResearchPanel({ isOpen, onClose, researchData, researchValidation, combinedDoc }) {
  const [activeTab, setActiveTab] = useState('combined');

  if (!isOpen) return null;

  const agentIds = Object.keys(researchData || {});
  const summary = researchValidation?.summary || {};
  const validation = researchValidation?.byAgent || {};

  return (
    <div style={{
      position:      'fixed',
      top:           0,
      left:          0,
      right:         0,
      bottom:        0,
      background:    'var(--surface-1)',
      zIndex:        500,
      display:       'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '0 20px',
        height:         52,
        borderBottom:   '1px solid var(--border-2)',
        background:     'var(--surface-0)',
        flexShrink:     0,
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize:   15,
          fontWeight: 600,
          color:      'var(--text-1)',
        }}>
          🔬 Research Panel
        </span>

        <button
          onClick={onClose}
          style={{
            background:   'var(--surface-3)',
            border:       '1px solid var(--border-2)',
            borderRadius: 'var(--radius-sm)',
            color:        'var(--text-2)',
            fontSize:     12,
            padding:      '5px 12px',
            cursor:       'pointer',
            fontFamily:   'var(--font-body)',
          }}
        >
          ✕ Close
        </button>
      </div>

      {/* Tab Bar */}
      <div style={{
        display:      'flex',
        gap:          4,
        padding:      '0 16px',
        borderBottom: '1px solid var(--border-2)',
        background:   'var(--surface-0)',
        flexShrink:   0,
      }}>
        {/* Combined tab */}
        <button
          onClick={() => setActiveTab('combined')}
          style={{
            padding:        '10px 14px',
            background:     'transparent',
            border:         'none',
            borderBottom:   activeTab === 'combined'
                              ? '2px solid var(--accent)'
                              : '2px solid transparent',
            color:          activeTab === 'combined'
                              ? 'var(--accent)'
                              : 'var(--text-3)',
            fontSize:       13,
            cursor:         'pointer',
            fontFamily:     'var(--font-body)',
            fontWeight:     activeTab === 'combined' ? 500 : 400,
          }}
        >
          📋 Combined Document
        </button>

        {/* Per-agent tabs */}
        {agentIds.map(agentId => (
          <button
            key={agentId}
            onClick={() => setActiveTab(agentId)}
            style={{
              padding:      '10px 14px',
              background:   'transparent',
              border:       'none',
              borderBottom: activeTab === agentId
                              ? `2px solid ${AGENT_COLORS[agentId] || '#888'}`
                              : '2px solid transparent',
              color:        activeTab === agentId
                              ? (AGENT_COLORS[agentId] || '#888')
                              : 'var(--text-3)',
              fontSize:     13,
              cursor:       'pointer',
              fontFamily:   'var(--font-body)',
              fontWeight:   activeTab === agentId ? 500 : 400,
              display:      'flex',
              alignItems:   'center',
              gap:          6,
            }}
          >
            <span style={{
              width:        7,
              height:       7,
              borderRadius: '50%',
              background:   AGENT_COLORS[agentId] || '#888',
              display:      'inline-block',
              flexShrink:   0,
            }} />
            {AGENT_NAMES[agentId] || agentId}
            <ValidationBadge status={validation[agentId]?.status} />
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{
        flex:      1,
        overflowY: 'auto',
        padding:   '32px 40px',
      }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          {activeTab === 'combined' ? (
            <div>
              <h2 style={{
                fontFamily:   'var(--font-display)',
                fontSize:     18,
                fontWeight:   600,
                color:        'var(--text-1)',
                marginBottom: 20,
              }}>
                Combined Research Document
              </h2>
              {researchValidation && (
                <div style={{
                  display: 'flex',
                  gap: 10,
                  flexWrap: 'wrap',
                  marginBottom: 20,
                  color: 'var(--text-2)',
                  fontSize: 12,
                }}>
                  <span>Ready: {summary.ready || 0}</span>
                  <span>No web: {summary.blocked || 0}</span>
                  <span>Failed: {summary.failed || 0}</span>
                  <span>Validated URLs: {summary.totalSources || 0}</span>
                </div>
              )}
              {combinedDoc ? (
                <div style={{
                  color:      'var(--text-1)',
                  fontFamily: 'var(--font-body)',
                  fontSize:   14,
                  lineHeight: 1.8,
                  whiteSpace: 'pre-wrap',
                  wordBreak:  'break-word',
                }}>
                  {combinedDoc}
                </div>
              ) : (
                <p style={{ color: 'var(--text-3)', fontSize: 14 }}>
                  Combined document not ready yet. Waiting for all agents to complete research.
                </p>
              )}
            </div>
          ) : (
            <div>
              <h2 style={{
                fontFamily:   'var(--font-display)',
                fontSize:     18,
                fontWeight:   600,
                color:        AGENT_COLORS[activeTab] || 'var(--text-1)',
                marginBottom: 12,
              }}>
                {AGENT_NAMES[activeTab] || activeTab} — Raw Research
              </h2>
              {validation[activeTab] && (
                <div style={{
                  border: '1px solid var(--border-2)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 12,
                  marginBottom: 20,
                  color: 'var(--text-2)',
                  fontSize: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <ValidationBadge status={validation[activeTab].status} />
                    <span>{validation[activeTab].urlCount || 0} validated URL(s)</span>
                  </div>
                  {validation[activeTab].issues?.length > 0 && (
                    <ul style={{ margin: '8px 0', paddingLeft: 18 }}>
                      {validation[activeTab].issues.map((issue, idx) => <li key={idx}>{issue}</li>)}
                    </ul>
                  )}
                  {validation[activeTab].urls?.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {validation[activeTab].urls.map(url => (
                        <a key={url} href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', wordBreak: 'break-all' }}>{url}</a>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {researchData[activeTab] ? (
                <div style={{
                  color:      'var(--text-1)',
                  fontFamily: 'var(--font-body)',
                  fontSize:   14,
                  lineHeight: 1.8,
                  whiteSpace: 'pre-wrap',
                  wordBreak:  'break-word',
                }}>
                  {researchData[activeTab]}
                </div>
              ) : (
                <p style={{ color: 'var(--text-3)', fontSize: 14 }}>
                  No research submitted yet from this agent.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
