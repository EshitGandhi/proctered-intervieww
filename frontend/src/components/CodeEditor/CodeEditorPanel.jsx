import React from 'react';
import Editor from '@monaco-editor/react';
import useCodeExecution from '../../hooks/useCodeExecution';

const LANGUAGES = [
  { id: 'python', label: 'Python', monacoLang: 'python' },
  { id: 'javascript', label: 'JavaScript', monacoLang: 'javascript' },
  { id: 'java', label: 'Java', monacoLang: 'java' },
  { id: 'c', label: 'C', monacoLang: 'c' },
  { id: 'cpp', label: 'C++', monacoLang: 'cpp' },
];

const THEMES = [
  { id: 'vs-dark', label: 'Dark' },
  { id: 'hc-black', label: 'High Contrast' },
  { id: 'light', label: 'Light' },
];

const CodeEditorPanel = ({ interviewId, readOnly = false, onSubmit, socket, roomId }) => {
  const [theme, setTheme] = React.useState('vs-dark');
  const [fontSize, setFontSize] = React.useState(14);
  const [explorerOpen, setExplorerOpen] = React.useState(true);

  const {
    language, setLanguage,
    sourceCode, setSourceCode,
    stdin, setStdin,
    stdout, stderr, compileOutput, status, executionTime,
    running, submitting,
    activeTab, setActiveTab,
    runCode, submitCode,
  } = useCodeExecution({ interviewId, socket, roomId, readOnly });

  const currentLang = LANGUAGES.find((l) => l.id === language);

  const handleSubmit = async () => {
    const submission = await submitCode();
    if (submission) onSubmit?.(submission);
  };

  const getStatusColor = () => {
    if (!status) return 'var(--text-muted)';
    if (status.includes('Accepted')) return 'var(--success)';
    if (status.includes('Error') || status.includes('Wrong')) return 'var(--danger)';
    return 'var(--warning)';
  };

  return (
    <div className="editor-panel" style={{ background: '#1e1e1e', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 1. VS Code Style Toolbar / Tabs */}
      <div style={{ display: 'flex', background: '#252526', height: '35px', alignItems: 'center', borderBottom: '1px solid #333' }}>
        {/* Explorer Toggle */}
        <button 
          onClick={() => setExplorerOpen(!explorerOpen)}
          style={{ width: '48px', height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', color: explorerOpen ? '#fff' : '#858585' }}
        >
          📁
        </button>
        
        {/* Active Tabs */}
        <div style={{ display: 'flex', height: '100%', overflowX: 'auto' }}>
          <div style={{ 
            display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8,
            background: '#1e1e1e', height: '100%', color: '#fff', borderTop: '1px solid var(--accent-primary)',
            fontSize: '13px', cursor: 'pointer'
          }}>
            <span>🐍</span>
            <span>solution.py</span>
            <span style={{ fontSize: '10px', opacity: 0.6 }}>✕</span>
          </div>
          <div style={{ 
            display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8,
            background: '#2d2d2d', height: '100%', color: '#969696',
            fontSize: '13px', cursor: 'pointer'
          }}>
            <span>📄</span>
            <span>readme.md</span>
          </div>
        </div>

        <div style={{ flex: 1 }} />
        
        {/* Execution Controls */}
        <div style={{ display: 'flex', gap: 8, paddingRight: 8 }}>
          <button 
            className="btn btn-primary" 
            style={{ height: '24px', padding: '0 12px', fontSize: '12px' }}
            onClick={runCode}
            disabled={running || submitting}
          >
            {running ? '⟳' : '▶ Run'}
          </button>
          {!readOnly && (
            <button 
              className="btn btn-success" 
              style={{ height: '24px', padding: '0 12px', fontSize: '12px' }}
              onClick={handleSubmit}
              disabled={running || submitting}
            >
              ✓ Submit
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 2. Left File Explorer (VS Code Style) */}
        {explorerOpen && (
          <div style={{ width: '220px', background: '#252526', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 16px', fontSize: '11px', color: '#bbb', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Explorer
            </div>
            <div style={{ padding: '4px 16px', fontSize: '13px', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⌄</span>
              <span style={{ fontWeight: 700 }}>PROJECT_ROOT</span>
            </div>
            <div style={{ padding: '4px 28px', fontSize: '13px', color: '#fff', background: '#37373d', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🐍</span>
              <span>solution.py</span>
            </div>
            <div style={{ padding: '4px 28px', fontSize: '13px', color: '#ccc', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📄</span>
              <span>readme.md</span>
            </div>
            <div style={{ padding: '4px 28px', fontSize: '13px', color: '#ccc', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚙️</span>
              <span>utils.py</span>
            </div>
          </div>
        )}

        {/* 3. Main Editor Stage */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
          
          <div style={{ flex: 1 }}>
            <Editor
              height="100%"
              language={currentLang?.monacoLang || 'python'}
              value={sourceCode}
              onChange={(val) => !readOnly && setSourceCode(val || '')}
              theme={theme}
              options={{
                fontSize,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                cursorBlinking: 'smooth',
                smoothScrolling: true,
                readOnly,
                contextmenu: false,
                fontFamily: "'Fira Code', monospace",
                fontLigatures: true,
                padding: { top: 12, bottom: 12 },
                scrollbar: {
                  vertical: 'visible',
                  horizontal: 'visible',
                  verticalScrollbarSize: 10,
                  horizontalScrollbarSize: 10
                }
              }}
            />
          </div>

          {/* 4. Console Section (LeetCode Style) */}
          <div style={{ height: '30%', borderTop: '2px solid #333', display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
             <div style={{ display: 'flex', borderBottom: '1px solid #333', background: '#252526' }}>
                <button 
                  className={`console-tab ${activeTab === 'input' ? 'active' : ''}`}
                  onClick={() => setActiveTab('input')}
                  style={{ border: 'none', background: 'transparent', padding: '8px 16px', fontSize: '12px', color: activeTab === 'input' ? '#fff' : '#858585', borderBottom: activeTab === 'input' ? '2px solid #fff' : 'none' }}
                >
                  Test Case
                </button>
                <button 
                  className={`console-tab ${activeTab === 'output' ? 'active' : ''}`}
                  onClick={() => setActiveTab('output')}
                  style={{ border: 'none', background: 'transparent', padding: '8px 16px', fontSize: '12px', color: activeTab === 'output' ? '#fff' : '#858585', borderBottom: activeTab === 'output' ? '2px solid #fff' : 'none' }}
                >
                  Result
                </button>
             </div>
             <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
                {activeTab === 'input' && (
                  <textarea
                    style={{
                      width: '100%', height: '100%', background: 'transparent', border: 'none', outline: 'none',
                      color: '#ddd', fontFamily: 'Fira Code, monospace',
                      fontSize: '13px', resize: 'none',
                    }}
                    placeholder="Enter stdin here…"
                    value={stdin}
                    onChange={(e) => setStdin(e.target.value)}
                    readOnly={readOnly}
                  />
                )}
                {activeTab === 'output' && (
                  <div style={{ fontFamily: 'Fira Code, monospace', fontSize: '13px' }}>
                    {status && (
                      <div style={{ marginBottom: 12, color: getStatusColor(), fontWeight: 700 }}>
                        {status} {executionTime && `| Time: ${executionTime}s`}
                      </div>
                    )}
                    {stdout && <pre style={{ color: '#86efac' }}>{stdout}</pre>}
                    {stderr && <pre style={{ color: '#fca5a5' }}>{stderr}</pre>}
                    {!stdout && !stderr && <span style={{ color: '#555' }}>Run your code to see results...</span>}
                  </div>
                )}
             </div>
          </div>

          {/* 5. VS Code Status Bar */}
          <div style={{ height: '22px', background: 'var(--accent-primary)', color: '#fff', fontSize: '12px', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>⎇</span>
              <span style={{ fontWeight: 600 }}>main</span>
            </div>
            <div style={{ flex: 1 }} />
            <div>
              Ln {sourceCode.split('\n').length}, Col 1
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: 12 }}>
              {currentLang?.label} {currentLang?.id === 'python' ? '3.x' : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeEditorPanel;
