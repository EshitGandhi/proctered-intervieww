const { exec } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

/**
 * Local Code Execution Engine
 * Evaluates JS and Python natively on the Backend Server!
 */
const LANGUAGE_CONFIG = {
  javascript: { ext: 'js', cmd: 'node' },
  python: { ext: 'py', cmd: 'python3' }, // Try python3 first
  java: { ext: 'java', cmd: 'java' },
  c: { ext: 'c', compile: 'gcc -o {out} {file}', cmd: './{out}' },
  cpp: { ext: 'cpp', compile: 'g++ -o {out} {file}', cmd: './{out}' }
};

const executeCode = async ({ language, sourceCode, stdin = '' }) => {
  const config = LANGUAGE_CONFIG[language];
  if (!config) throw new Error(`Unsupported local language fallback: ${language}`);

  // For safety and MVP purposes on Free Render tiers where Python might be 'python' instead of 'python3'
  let cmdToRun = config.cmd;
  
  const id = crypto.randomUUID();
  const dir = os.tmpdir();
  const filePath = path.join(dir, `${id}.${config.ext}`);
  
  try {
    await fs.writeFile(filePath, sourceCode);
    
    // Quick test if python3 exists, else fallback to python
    if (language === 'python') {
       try {
          await execPromise('python3 --version');
       } catch {
          cmdToRun = 'python'; // Fallback for Windows/Some Linux
       }
    }

    const { stdout, stderr } = await execPromise(`${cmdToRun} "${filePath}"`, { 
      timeout: 5000, 
      maxBuffer: 1024 * 500, // 500kb
      stdin 
    });

    return {
      stdout: stdout || '',
      stderr: stderr || '',
      compileOutput: '',
      status: stderr ? 'Runtime Error' : 'Accepted',
      time: '0.1',
      memory: '2048',
      languageId: language,
    };
  } catch (err) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || err.message || 'Execution failed',
      compileOutput: '',
      status: err.killed ? 'Time Limit Exceeded' : 'Error',
      time: '5.0',
      memory: '0',
      languageId: language,
    };
  } finally {
    try { await fs.unlink(filePath); } catch (e) {}
  }
};

// Helper to run exec with stdin
const execPromise = (command, options = {}) => {
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process');
    const child = exec(command, { timeout: options.timeout, maxBuffer: options.maxBuffer }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
    
    // Write stdin if provided
    if (options.stdin && options.stdin.trim().length > 0) {
      child.stdin.write(options.stdin);
      child.stdin.end();
    } else {
      child.stdin.end();
    }
  });
};

module.exports = { executeCode, LANGUAGE_IDS: { javascript: 1, python: 2, java: 3, c: 4, cpp: 5 } };
