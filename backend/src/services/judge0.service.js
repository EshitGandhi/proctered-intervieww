const axios = require('axios');

/**
 * Paiza.io Language IDs
 */
const LANGUAGE_IDS = {
  javascript: 'javascript',
  python: 'python3',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
};

const executeCode = async ({ language, sourceCode, stdin = '' }) => {
  const languageId = LANGUAGE_IDS[language];
  if (!languageId) throw new Error(`Unsupported language: ${language}`);

  // 1. Create a runner session
  const createRes = await axios.post('http://api.paiza.io/runners/create', {
    source_code: sourceCode,
    language: languageId,
    input: stdin,
    longpoll: true,
    api_key: 'guest'
  });

  if (createRes.data.error) throw new Error(createRes.data.error);
  const id = createRes.data.id;

  // 2. Poll for the result (paiza handles execution queue)
  let result = null;
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    const getRes = await axios.get(`http://api.paiza.io/runners/get_details?id=${id}&api_key=guest`);
    if (getRes.data.status === 'completed') {
      result = getRes.data;
      break;
    }
  }

  if (!result) throw new Error('Code execution timed out');

  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    compileOutput: result.build_stderr || '',
    status: result.build_exit_code !== 0 ? 'Compilation Error' : (result.exit_code !== 0 ? 'Runtime Error' : 'Accepted'),
    time: result.time,
    memory: result.memory,
    languageId,
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = { executeCode, LANGUAGE_IDS };
