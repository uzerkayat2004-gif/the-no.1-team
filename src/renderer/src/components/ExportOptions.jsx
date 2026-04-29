import React, { useState } from 'react'

export default function ExportOptions({ sessionData, folderRel, onExported }) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async (format) => {
    setExporting(true)
    try {
      let result;
      if (format === 'pdf') {
        if (window.teamAPI?.ipcRenderer) {
          result = await window.teamAPI.ipcRenderer.invoke('export:toPDF', { sessionData, folderRel })
        } else if (window.teamAPI?.export?.toPDF) {
          result = await window.teamAPI.export.toPDF(JSON.stringify({ sessionData, folderRel }))
        } else {
          result = await window.teamAPI?.exportSession?.({ format, sessionData, folderRel })
        }
      } else {
        result = await window.teamAPI?.exportSession?.({ format, sessionData, folderRel })
      }
      
      if (result?.success) onExported?.(result.filePath || result.data)
    } catch (e) { console.error('Export error:', e) }
    setExporting(false)
  }

  const formats = [
    { label: '📄 Markdown', format: 'markdown' },
    { label: '📋 Plain Text', format: 'plain' },
    { label: '📊 Full Report', format: 'full-report' },
    { label: '📑 PDF', format: 'pdf' },
  ]

  return (
    <div className="export-options">
      <p className="export-label">📤 Export this session</p>
      <div className="export-buttons">
        {formats.map(opt => (
          <button key={opt.format} onClick={() => handleExport(opt.format)}
            disabled={exporting} className="export-btn">
            {exporting ? '...' : opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
