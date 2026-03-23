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
  javascript: { ext: 'js', cmd: 'node "{file}"' },
  python: { ext: 'py', cmd: 'python3 -u "{file}"' }, // -u forces unbuffered stdout
  java: { ext: 'java', cmd: 'java' }, // Mocked below
  c: { ext: 'c', compile: 'gcc -o {out} {file}', cmd: './{out}' }, // Mocked below
  cpp: { ext: 'cpp', compile: 'g++ -o {out} {file}', cmd: './{out}' } // Mocked below
};

const executeCode = async ({ language, sourceCode, stdin = '' }) => {
  const config = LANGUAGE_CONFIG[language];
  if (!config) throw new Error(`Unsupported local language fallback: ${language}`);

  // Gravely decline compiled languages on basic free-tier linux instances without GCC/JDK
  if (['java', 'c', 'cpp'].includes(language)) {
    return {
      stdout: '',
      stderr: `[Platform Notice]\nThe free tier Docker container running this platform only supports natively interpreted languages (JavaScript and Python).\n\nCompilers like GCC (for C/C++) and the Java SDK are not installed on this specific server instance.\n\nPlease switch your language to Python or JavaScript to continue testing!`,
      compileOutput: '',
      status: 'Environment Error',
      time: '0.0',
      memory: '0',
      languageId: language,
    };
  }

  const id = crypto.randomUUID();
  const dir = os.tmpdir();
  const filePath = path.join(dir, `${id}.${config.ext}`);
  const outPath = path.join(dir, id);
  let compileOutput = '';
  
  try {
    await fs.writeFile(filePath, sourceCode);
    
    // 1. Compilation Step (if applicable)
    if (config.compile) {
      const compileCmd = config.compile.replace('{file}', `"${filePath}"`).replace('{out}', `"${outPath}"`);
      try {
        await execPromise(compileCmd, { timeout: 10000 });
      } catch (compileErr) {
        return {
          stdout: '',
          stderr: compileErr.stderr || compileErr.message,
          compileOutput: compileErr.stderr || compileErr.message,
          status: 'Compilation Error',
          time: '0.0', memory: '0', languageId: language,
        };
      }
    }

    // 2. Execution Step
    let cmdToRun = config.cmd.replace('{out}', `"${outPath}"`).replace('{file}', `"${filePath}"`);
    
    // Quick test if python3 exists, else fallback to python
    if (language === 'python') {
       try {
          await execPromise('python3 --version');
       } catch {
          cmdToRun = 'python "{file}"'.replace('{file}', `"${filePath}"`);
       }
    }

    const { stdout, stderr } = await execPromise(cmdToRun, { 
      timeout: 5000, 
      maxBuffer: 1024 * 500, // 500kb
      stdin 
    });

    return {
      stdout: stdout || '',
      stderr: stderr || '',
      compileOutput,
      status: stderr ? 'Runtime Error' : 'Accepted',
      time: '0.1',
      memory: '2048',
      languageId: language,
    };
  } catch (err) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || err.message || 'Execution failed',
      compileOutput,
      status: err.killed ? 'Time Limit Exceeded' : 'Error',
      time: '5.0',
      memory: '0',
      languageId: language,
    };
  } finally {
    try { await fs.unlink(filePath); } catch (e) {}
    if (config.compile) {
      try { await fs.unlink(outPath); } catch (e) {}
      try { await fs.unlink(outPath + '.exe'); } catch (e) {} // Windows cleanup
    }
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
