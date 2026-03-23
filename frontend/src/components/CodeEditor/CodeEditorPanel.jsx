import React from 'react';
import Editor from '@monaco-editor/react';
import useCodeExecution from '../../hooks/useCodeExecution';

const LANGUAGES = [
  { id: 'python', label: 'Python', monacoLang: 'python' },
  { id: 'javascript', label: 'JavaScript', monacoLang: 'javascript' },
];

const THEMES = [
  { id: 'vs-dark', label: 'Dark' },
  { id: 'hc-black', label: 'High Contrast' },
  { id: 'light', label: 'Light' },
];

const CodeEditorPanel = ({ interviewId, readOnly = false, onSubmit, socket, roomId }) => {
  const [theme, setTheme] = React.useState('vs-dark');
  const [fontSize, setFontSize] = React.useState(14);

  const {
    language, setLanguage,
    sourceCode, setSourceCode,
    stdin, setStdin,
    stdout, stderr, compileOutput, status, executionTime,
    running, submitting,
    lastSubmission,
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
    <div className="editor-panel">
      {/* Toolbar */}
      <div className="editor-toolbar">
        {/* Language selector */}
        <select
          className="input select"
          style={{ width: 130, padding: '6px 32px 6px 12px' }}
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={readOnly}
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>

        {/* Theme selector */}
        <select
          className="input select"
          style={{ width: 120, padding: '6px 32px 6px 12px' }}
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        >
          {THEMES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>

        {/* Font size */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setFontSize(f => Math.max(10, f - 1))}>A-</button>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: 30, textAlign: 'center' }}>{fontSize}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setFontSize(f => Math.min(24, f + 1))}>A+</button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Status indicator */}
        {status && (
          <span style={{
            fontSize: '0.75rem', fontWeight: 700, color: getStatusColor(),
            background: `${getStatusColor()}20`, padding: '3px 10px',
            borderRadius: 20, border: `1px solid ${getStatusColor()}40`,
          }}>
            {status}
            {executionTime && ` · ${executionTime}s`}
          </span>
        )}

        {!readOnly && (
          <>
            <button
              className="btn btn-secondary btn-sm"
              onClick={runCode}
              disabled={running || submitting}
            >
              {running ? '⟳ Running…' : '▶ Run'}
            </button>
            <button
              className="btn btn-success btn-sm"
              onClick={handleSubmit}
              disabled={running || submitting || !interviewId}
            >
              {submitting ? '⟳ Submitting…' : '✓ Submit'}
            </button>
          </>
        )}
      </div>

      {/* Monaco Editor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
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
            contextmenu: false, // disable right-click context menu in editor
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontLigatures: true,
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>

      {/* I/O Console */}
      <div className="io-console" style={{ maxHeight: 220, display: 'flex', flexDirection: 'column' }}>
        <div className="console-tabs" style={{ flexShrink: 0 }}>
          {[
            { id: 'input', label: 'Input (stdin)' },
            { id: 'output', label: 'Output' },
            { id: 'errors', label: `Errors${(stderr || compileOutput) ? ' ⚠' : ''}` },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`console-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="console-content">
          {activeTab === 'input' && (
            <textarea
              style={{
                width: '100%', background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.8rem', resize: 'none', minHeight: 80,
              }}
              placeholder="Enter stdin here (optional)…"
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              readOnly={readOnly}
            />
          )}

          {activeTab === 'output' && (
            stdout
              ? <pre className="console-stdout">{stdout}</pre>
              : <span className="console-empty">Run code to see output…</span>
          )}

          {activeTab === 'errors' && (
            (stderr || compileOutput)
              ? (
                <>
                  {compileOutput && <pre className="console-stderr">{compileOutput}</pre>}
                  {stderr && <pre className="console-stderr">{stderr}</pre>}
                </>
              )
              : <span className="console-empty">No errors 🎉</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default CodeEditorPanel;
