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
  const [theme, setTheme] = React.useState('light');
  const [fontSize, setFontSize] = React.useState(14);

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
    <div className="editor-panel" style={{ background: 'var(--bg-secondary)', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 1. Toolbar */}
      <div style={{ display: 'flex', background: 'var(--bg-tertiary)', height: '40px', alignItems: 'center', borderBottom: '1px solid var(--border)', padding: '0 12px' }}>
        
        {/* Active Tab View */}
        <div style={{ display: 'flex', height: '100%' }}>
          <div style={{ 
            display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8,
            background: 'var(--bg-secondary)', height: '100%', color: 'var(--text-primary)', borderTop: '1px solid var(--accent-primary)',
            fontSize: '13px'
          }}>
            <span>Code Editor</span>
          </div>
        </div>

        <div style={{ flex: 1 }} />
        
        {/* Language Selector & Execution Controls */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* Language Switcher */}
          {!readOnly && (
            <select
              className="input"
              style={{ 
                height: '24px', padding: '0 8px', fontSize: '12px', background: 'var(--bg-secondary)', 
                border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '4px' 
              }}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          )}

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
        {/* 2. Main Editor Stage */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
          
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

          {/* 3. Console Section (LeetCode Style) */}
          <div style={{ height: '30%', borderTop: '2px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
             <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}>
                <button 
                  className={`console-tab ${activeTab === 'input' ? 'active' : ''}`}
                  onClick={() => setActiveTab('input')}
                  style={{ border: 'none', background: 'transparent', padding: '10px 16px', fontSize: '12px', color: activeTab === 'input' ? 'var(--text-primary)' : 'var(--text-muted)', borderBottom: activeTab === 'input' ? '2px solid var(--accent-primary)' : 'none', cursor: 'pointer' }}
                >
                  Test Case
                </button>
                <button 
                  className={`console-tab ${activeTab === 'output' ? 'active' : ''}`}
                  onClick={() => setActiveTab('output')}
                  style={{ border: 'none', background: 'transparent', padding: '10px 16px', fontSize: '12px', color: activeTab === 'output' ? 'var(--text-primary)' : 'var(--text-muted)', borderBottom: activeTab === 'output' ? '2px solid var(--accent-primary)' : 'none', cursor: 'pointer' }}
                >
                  Result
                </button>
             </div>
             <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
                {activeTab === 'input' && (
                  <textarea
                    style={{
                      width: '100%', height: '100%', background: 'transparent', border: 'none', outline: 'none',
                      color: 'var(--text-primary)', fontFamily: 'Fira Code, monospace',
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
                    {stdout && <pre style={{ color: '#15803d' }}>{stdout}</pre>}
                    {stderr && <pre style={{ color: '#dc2626' }}>{stderr}</pre>}
                    {!stdout && !stderr && <span style={{ color: 'var(--text-muted)' }}>Run your code to see results...</span>}
                  </div>
                )}
             </div>
          </div>

          {/* 4. Status Bar */}
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
              {currentLang?.label}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeEditorPanel;
