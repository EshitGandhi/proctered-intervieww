const axios = require('axios');

/**
 * Judge0-based Code Execution Engine
 * Evaluates Python, JS, Java, C, and C++ using the Judge0 API.
 */

// Use CE community instance if no URL provided: https://ce.judge0.com
const JUDGE0_URL = process.env.JUDGE0_API_URL || 'https://ce.judge0.com';
const JUDGE0_KEY = process.env.JUDGE0_API_KEY;

// Judge0 Language IDs (for CE Edition)
const JUDGE0_LANG_IDS = {
  javascript: 63, // Node.js 12.14.0
  python: 71,     // Python 3.8.1
  java: 62,       // Java 13.0.1
  c: 50,          // GCC 9.2.0
  cpp: 54         // GCC 9.2.0
};

const executeCode = async ({ language, sourceCode, stdin = '' }) => {
  try {
    const languageId = JUDGE0_LANG_IDS[language];
    if (!languageId) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const options = {
      method: 'POST',
      url: `${JUDGE0_URL}/submissions`,
      params: { base64_encoded: 'true', wait: 'true' },
      headers: {
        'content-type': 'application/json',
        'Content-Type': 'application/json',
        ...(JUDGE0_KEY && JUDGE0_KEY !== 'your_judge0_rapidapi_key' ? { 'X-RapidAPI-Key': JUDGE0_KEY } : {}),
        ...(JUDGE0_KEY && JUDGE0_KEY !== 'your_judge0_rapidapi_key' ? { 'X-RapidAPI-Host': new URL(JUDGE0_URL).hostname } : {})
      },
      data: {
        source_code: Buffer.from(sourceCode || '').toString('base64'),
        language_id: languageId,
        stdin: Buffer.from(stdin || '').toString('base64')
      }
    };

    const response = await axios.request(options);
    const result = response.data;

    return {
      stdout: result.stdout ? Buffer.from(result.stdout, 'base64').toString('utf8') : '',
      stderr: result.stderr ? Buffer.from(result.stderr, 'base64').toString('utf8') : '',
      compileOutput: result.compile_output ? Buffer.from(result.compile_output, 'base64').toString('utf8') : '',
      status: result.status?.description || 'Unknown Status',
      time: result.time || '0.0',
      memory: result.memory || 0,
      languageId: languageId,
    };
  } catch (err) {
    console.error('Judge0 execution error:', err.response?.data || err.message);
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

module.exports = { 
  executeCode, 
  LANGUAGE_IDS: JUDGE0_LANG_IDS 
};
