import React, { useState, useCallback, useRef, useEffect } from 'react';
import api from '../services/api';

/**
 * useCodeExecution — handles Monaco editor state and Judge0 API calls.
 */
const useCodeExecution = ({ interviewId, socket, roomId, readOnly }) => {
  const [language, setLanguage] = useState('python');
  const [sourceCode, setSourceCode] = useState(DEFAULT_CODE['python']);
  const [stdin, setStdin] = useState('');
  const [stdout, setStdout] = useState('');
  const [stderr, setStderr] = useState('');
  const [compileOutput, setCompileOutput] = useState('');
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSubmission, setLastSubmission] = useState(null);
  const [executionTime, setExecutionTime] = useState(null);
  const [activeTab, setActiveTab] = useState('output');

  // Socket sync listeners
  React.useEffect(() => {
    if (!socket || !roomId) return;
    socket.on('code-sync', ({ code, lang, inp }) => {
      if (code !== undefined) setSourceCode(code);
      if (lang !== undefined) setLanguage(lang);
      if (inp !== undefined) setStdin(inp);
    });
    return () => socket.off('code-sync');
  }, [socket, roomId]);

  // Wrapper for setting source code that also emits
  const handleCodeChange = useCallback((newCode) => {
    setSourceCode(newCode);
    if (socket && roomId && !readOnly) {
      socket.emit('code-sync', { roomId, code: newCode });
    }
  }, [socket, roomId, readOnly]);

  const handleLanguageChange = useCallback((lang) => {
    setLanguage(lang);
    const newCode = DEFAULT_CODE[lang] || '// Start coding here\n';
    setSourceCode(newCode);
    setStdout('');
    setStderr('');
    setStatus('');
    if (socket && roomId && !readOnly) {
      socket.emit('code-sync', { roomId, lang, code: newCode });
    }
  }, [socket, roomId, readOnly]);

  const handleStdinChange = useCallback((inp) => {
    setStdin(inp);
    if (socket && roomId && !readOnly) {
      socket.emit('code-sync', { roomId, inp });
    }
  }, [socket, roomId, readOnly]);

  const clearOutput = () => {
    setStdout('');
    setStderr('');
    setCompileOutput('');
    setStatus('');
    setExecutionTime(null);
  };

  const runCode = useCallback(async () => {
    if (!sourceCode.trim()) return;
    setRunning(true);
    clearOutput();
    try {
      const { data } = await api.post('/code/run', {
        language,
        sourceCode,
        stdin,
        interviewId,
      });
      const r = data.data;
      setStdout(r.stdout || '');
      setStderr(r.stderr || '');
      setCompileOutput(r.compileOutput || '');
      setStatus(r.status || '');
      setExecutionTime(r.time);
      setActiveTab(r.stderr || r.compileOutput ? 'errors' : 'output');
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setStderr(`Execution error: ${msg}`);
      setActiveTab('errors');
    } finally {
      setRunning(false);
    }
  }, [language, sourceCode, stdin, interviewId]);

  const submitCode = useCallback(async () => {
    if (!sourceCode.trim() || !interviewId) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/code/submit', {
        language,
        sourceCode,
        stdin,
        interviewId,
      });
      const r = data.data.result;
      setStdout(r.stdout || '');
      setStderr(r.stderr || '');
      setCompileOutput(r.compileOutput || '');
      setStatus(r.status || '');
      setExecutionTime(r.time);
      setLastSubmission(data.data.submission);
      setActiveTab(r.stderr || r.compileOutput ? 'errors' : 'output');
      return data.data.submission;
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setStderr(`Submit error: ${msg}`);
      setActiveTab('errors');
    } finally {
      setSubmitting(false);
    }
  }, [language, sourceCode, stdin, interviewId]);

  return {
    language, setLanguage: handleLanguageChange,
    sourceCode, setSourceCode: handleCodeChange,
    stdin, setStdin: handleStdinChange,
    stdout, stderr, compileOutput, status, executionTime,
    running, submitting,
    lastSubmission,
    activeTab, setActiveTab,
    runCode, submitCode,
    clearOutput,
  };
};

const DEFAULT_CODE = {
  python: `# Python solution
def solve():
    # Read input
    # n = int(input())
    print("Hello, World!")

solve()
`,
  javascript: `// JavaScript solution
function solve() {
  // Your code here
  console.log("Hello, World!");
}

solve();
`,
  java: `import java.util.*;

public class Main {
  public static void main(String[] args) {
    Scanner sc = new Scanner(System.in);
    System.out.println("Hello, World!");
  }
}
`,
  c: `#include <stdio.h>

int main() {
  printf("Hello, World!\\n");
  return 0;
}
`,
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
  ios_base::sync_with_stdio(false);
  cin.tie(NULL);
  
  cout << "Hello, World!" << endl;
  return 0;
}
`,
};

export { DEFAULT_CODE };
export default useCodeExecution;
