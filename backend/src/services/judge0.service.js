const axios = require('axios');

/**
 * Judge0 Language IDs
 * Reference: https://ce.judge0.com/languages/
 */
const LANGUAGE_IDS = {
  javascript: 63,
  python: 71,
  java: 62,
  c: 50,
  cpp: 54,
};

/**
 * Submit code to Judge0 API and poll for result.
 * @param {object} params - { language, sourceCode, stdin }
 * @returns {object} - { stdout, stderr, compileOutput, status, time, memory }
 */
const executeCode = async ({ language, sourceCode, stdin = '' }) => {
  const languageId = LANGUAGE_IDS[language];
  if (!languageId) throw new Error(`Unsupported language: ${language}`);

  const apiKey = process.env.JUDGE0_API_KEY;
  const apiUrl = process.env.JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com';

  const headers = {
    'Content-Type': 'application/json',
  };

  // If using RapidAPI key
  if (apiKey && apiKey !== 'your_judge0_rapidapi_key') {
    headers['X-RapidAPI-Key'] = apiKey;
    headers['X-RapidAPI-Host'] = 'judge0-ce.p.rapidapi.com';
  }

  // Encode source code and stdin as base64
  const encodedSource = Buffer.from(sourceCode).toString('base64');
  const encodedStdin = Buffer.from(stdin).toString('base64');

  // Submit code
  const submitResponse = await axios.post(
    `${apiUrl}/submissions?base64_encoded=true&wait=false`,
    {
      language_id: languageId,
      source_code: encodedSource,
      stdin: encodedStdin,
    },
    { headers }
  );

  const token = submitResponse.data.token;
  if (!token) throw new Error('Failed to submit code to Judge0');

  // Poll for result (max 15 seconds)
  let result = null;
  const maxPolls = 15;
  for (let i = 0; i < maxPolls; i++) {
    await sleep(1000);
    const pollResponse = await axios.get(
      `${apiUrl}/submissions/${token}?base64_encoded=true`,
      { headers }
    );
    const { status } = pollResponse.data;

    // Status IDs 1 (In Queue) and 2 (Processing) mean still running
    if (status.id > 2) {
      result = pollResponse.data;
      break;
    }
  }

  if (!result) throw new Error('Code execution timed out');

  return {
    stdout: result.stdout ? Buffer.from(result.stdout, 'base64').toString() : '',
    stderr: result.stderr ? Buffer.from(result.stderr, 'base64').toString() : '',
    compileOutput: result.compile_output
      ? Buffer.from(result.compile_output, 'base64').toString()
      : '',
    status: result.status?.description || 'Unknown',
    statusId: result.status?.id,
    time: result.time,
    memory: result.memory,
    languageId,
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = { executeCode, LANGUAGE_IDS };
