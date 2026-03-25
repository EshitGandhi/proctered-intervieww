const axios = require('axios');

/**
 * Piston-based Code Execution Engine
 * Evaluates Python, JS, Java, C, and C++ using the Piston API.
 */

const PISTON_URL = 'https://emkc.org/api/v2/piston/execute';

const LANGUAGE_VERSIONS = {
  javascript: '18.15.0',
  python: '3.10.0',
  java: '15.0.2',
  c: '10.2.0',
  cpp: '10.2.0'
};

const executeCode = async ({ language, sourceCode, stdin = '' }) => {
  try {
    const response = await axios.post(PISTON_URL, {
      language: language === 'javascript' ? 'node-js' : language, // node-js is the identifier for JS in Piston
      version: '*', // Use latest available version
      files: [
        {
          name: language === 'java' ? 'Main.java' : `main.${getExt(language)}`,
          content: sourceCode
        }
      ],
      stdin: stdin
    });

    const { run, compile } = response.data;
    
    // Determine status
    let status = 'Accepted';
    if (compile && compile.code !== 0) {
      status = 'Compilation Error';
    } else if (run.code !== 0) {
      if (run.signal === 'SIGKILL') {
        status = 'Time Limit Exceeded';
      } else {
        status = 'Runtime Error';
      }
    }

    return {
      stdout: run.stdout || '',
      stderr: run.stderr || '',
      compileOutput: compile ? compile.stderr || compile.stdout || '' : '',
      status: status,
      time: '0.1', // Piston doesn't provide precise execution time easily
      memory: 2048,
      languageId: language,
    };
  } catch (err) {
    console.error('Piston execution error:', err.response?.data || err.message);
    return {
      stdout: '',
      stderr: `Execution failed: ${err.response?.data?.message || err.message}`,
      compileOutput: '',
      status: 'Server Error',
      time: '0.0',
      memory: 0,
      languageId: language,
    };
  }
};

const getExt = (lang) => {
  const map = {
    python: 'py',
    javascript: 'js',
    java: 'java',
    c: 'c',
    cpp: 'cpp'
  };
  return map[lang] || 'txt';
};

module.exports = { 
  executeCode, 
  LANGUAGE_IDS: { javascript: 1, python: 2, java: 3, c: 4, cpp: 5 } 
};
