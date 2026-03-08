const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROBLEMS_DIR = path.join(__dirname, 'problems');
const TEMP_DIR = os.tmpdir();

const MAX_CODE_BYTES = 100 * 1024; // ~100KB
const MAX_OUTPUT_CHARS = 100_000; // limit pentru output pe test

const BANNED_INCLUDES = [
  'windows.h',
  'direct.h',
  'process.h',
  'thread',
  'filesystem'
];

function normalizeOutput(str) {
  if (str == null) return '';
  return String(str).trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function outputsMatch(actual, expected) {
  return normalizeOutput(actual) === normalizeOutput(expected);
}

function hasBannedInclude(code) {
  const lower = String(code).toLowerCase();
  if (!lower.includes('#include')) return false;
  return BANNED_INCLUDES.some(name => lower.includes(`<${name.toLowerCase()}>`));
}

function summarizeCompileError(stderr) {
  const text = stderr || '';
  if (text.includes('was not declared in this scope')) {
    return 'Probabil ai folosit o variabilă sau o funcție nedeclarată (sau ai scris greșit numele).';
  }
  if (text.includes('expected') && text.includes('before') && text.includes('token')) {
    return 'Pare să lipsească un simbol de punctuație (de obicei ; sau ). Verifică linia indicată.';
  }
  if (text.includes('no matching function for call to')) {
    return 'Apel de funcție cu parametri greșiți (tip sau număr diferit de argumente).';
  }
  if (text.includes('cannot convert') || text.includes('invalid conversion')) {
    return 'Conversie de tip incorectă. Verifică tipurile variabilelor și expresiilor.';
  }
  if (text.includes('redefinition of')) {
    return 'Ai definit de două ori aceeași funcție sau variabilă.';
  }
  if (text.includes('expected') && text.includes('}')) {
    return 'Probabil lipsește o acoladă } sau sunt așezate greșit blocurile de cod.';
  }
  return 'Există o eroare de compilare. Verifică linia indicată în mesajul de mai jos (sintaxă, tipuri sau variabile nedeclarate).';
}

async function runJudge(problemId, code) {
  const problemPath = path.join(PROBLEMS_DIR, String(problemId));
  const problemJsonPath = path.join(problemPath, 'problem.json');
  const testsDir = path.join(problemPath, 'tests');

  if (!fs.existsSync(problemJsonPath)) {
    return { verdict: 'Internal Error', message: 'Problema nu există' };
  }

  const problem = JSON.parse(fs.readFileSync(problemJsonPath, 'utf8'));
  const timeLimit = problem.timeLimit || 2000;
  const testsCount = problem.testsCount || 10;

  const codeStr = String(code ?? '');
  const codeBytes = Buffer.byteLength(codeStr, 'utf8');

  if (!codeStr.trim()) {
    return {
      verdict: 'Compile Error',
      message: 'Codul trimis este gol. Scrie o soluție în C++ și încearcă din nou.',
      friendlyMessage: 'Nu ai trimis niciun cod sau acesta conține doar spații.',
      passedTests: 0,
      totalTests: testsCount
    };
  }

  if (codeBytes > MAX_CODE_BYTES) {
    return {
      verdict: 'Compile Error',
      message: `Codul este prea mare (${codeBytes} bytes). Încearcă să simplifici soluția.`,
      friendlyMessage: 'Codul depășește limita de mărime acceptată pentru acest sistem.',
      passedTests: 0,
      totalTests: testsCount
    };
  }

  if (hasBannedInclude(codeStr)) {
    return {
      verdict: 'Compile Error',
      message: 'Ai folosit un header care nu este permis în acest mediu (ex: <windows.h>, <thread>, <filesystem>).',
      friendlyMessage: 'Include-urile avansate nu sunt permise pentru acest atestat. Folosește doar bibliotecile standard uzuale (iostream, cmath, vector etc.).',
      passedTests: 0,
      totalTests: testsCount
    };
  }

  const tempId = `judge_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const sourcePath = path.join(TEMP_DIR, `${tempId}.cpp`);
  const exeName = process.platform === 'win32' ? `${tempId}.exe` : tempId;
  const exePath = path.join(TEMP_DIR, exeName);

  try {
    fs.writeFileSync(sourcePath, codeStr, 'utf8');

    // Compilare
    try {
      const out = execSync(`g++ -o "${exePath}" "${sourcePath}" -std=c++17 -O2`, {
        timeout: 10000,
        encoding: 'utf8'
      });
    } catch (compileErr) {
      const stderr = compileErr.stderr || compileErr.message || '';
      const raw = stderr.slice(0, 800);
      return {
        verdict: 'Compile Error',
        message: raw,
        friendlyMessage: summarizeCompileError(stderr),
        passedTests: 0,
        totalTests: testsCount
      };
    }

    let passedTests = 0;
    let firstFailedTest = null;
    let wrongOutput = null;
    let expectedOutput = null;

    for (let i = 1; i <= testsCount; i++) {
      const inPath = path.join(testsDir, `${i}.in`);
      const outPath = path.join(testsDir, `${i}.out`);

      if (!fs.existsSync(inPath) || !fs.existsSync(outPath)) break;

      const input = fs.readFileSync(inPath, 'utf8');
      const expected = fs.readFileSync(outPath, 'utf8');

      try {
        const result = await new Promise((resolve, reject) => {
          const proc = spawn(exePath, [], {
            cwd: TEMP_DIR,
            stdio: ['pipe', 'pipe', 'pipe']
          });

          let stdout = '';
          let stderr = '';

          proc.stdout.on('data', d => {
            stdout += d.toString();
            if (stdout.length > MAX_OUTPUT_CHARS) {
              stdout = stdout.slice(0, MAX_OUTPUT_CHARS);
            }
          });
          proc.stderr.on('data', d => {
            stderr += d.toString();
            if (stderr.length > MAX_OUTPUT_CHARS) {
              stderr = stderr.slice(0, MAX_OUTPUT_CHARS);
            }
          });

          proc.stdin.write(input);
          proc.stdin.end();

          const timeout = setTimeout(() => {
            proc.kill();
            reject(new Error('Timeout'));
          }, timeLimit);

          proc.on('close', code => {
            clearTimeout(timeout);
            resolve({ stdout, stderr, code });
          });

          proc.on('error', err => reject(err));
        });

        if (outputsMatch(result.stdout, expected)) {
          passedTests++;
        } else {
          if (firstFailedTest === null) {
            firstFailedTest = i;
            wrongOutput = result.stdout;
            expectedOutput = expected;
          }
          break;
        }
      } catch (err) {
        if (err.message === 'Timeout') {
          return {
            verdict: 'Time Limit Exceeded',
            passedTests,
            totalTests: testsCount,
            failedTest: i
          };
        }
        throw err;
      }
    }

    if (firstFailedTest !== null) {
      return {
        verdict: 'Wrong Answer',
        passedTests,
        totalTests: testsCount,
        failedTest: firstFailedTest,
        wrongOutput: wrongOutput?.slice(0, 200),
        expectedOutput: expectedOutput?.slice(0, 200)
      };
    }

    return {
      verdict: 'Accepted',
      passedTests,
      totalTests: testsCount
    };

  } finally {
    try {
      if (fs.existsSync(sourcePath)) fs.unlinkSync(sourcePath);
      if (fs.existsSync(exePath)) fs.unlinkSync(exePath);
    } catch (_) { }
  }
}

// Rulează cod cu input custom (pentru testare manuală)
async function runWithCustomInput(code, input) {
  const codeStr = String(code ?? '');
  const codeBytes = Buffer.byteLength(codeStr, 'utf8');

  if (!codeStr.trim()) {
    return {
      success: false,
      output: '',
      error: 'Codul trimis este gol.'
    };
  }

  if (codeBytes > MAX_CODE_BYTES) {
    return {
      success: false,
      output: '',
      error: `Codul este prea mare (${codeBytes} bytes).`
    };
  }

  if (hasBannedInclude(codeStr)) {
    return {
      success: false,
      output: '',
      error: 'Ai folosit un header care nu este permis.'
    };
  }

  const tempId = `run_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const sourcePath = path.join(TEMP_DIR, `${tempId}.cpp`);
  const exeName = process.platform === 'win32' ? `${tempId}.exe` : tempId;
  const exePath = path.join(TEMP_DIR, exeName);

  try {
    fs.writeFileSync(sourcePath, codeStr, 'utf8');

    // Compilare
    try {
      execSync(`g++ -o "${exePath}" "${sourcePath}" -std=c++17 -O2`, {
        timeout: 10000,
        encoding: 'utf8'
      });
    } catch (compileErr) {
      const stderr = compileErr.stderr || compileErr.message || '';
      return {
        success: false,
        output: '',
        error: 'Compile Error: ' + stderr.slice(0, 500),
        friendlyError: summarizeCompileError(stderr)
      };
    }

    // Rulare cu input custom
    const result = await new Promise((resolve, reject) => {
      const proc = spawn(exePath, [], {
        cwd: TEMP_DIR,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let killed = false;

      const timer = setTimeout(() => {
        killed = true;
        proc.kill('SIGKILL');
      }, 5000); // 5 secunde timeout

      proc.stdout.on('data', chunk => {
        if (stdout.length < MAX_OUTPUT_CHARS) {
          stdout += chunk.toString();
        }
      });

      proc.stderr.on('data', chunk => {
        stderr += chunk.toString().slice(0, 500);
      });

      proc.on('error', err => {
        clearTimeout(timer);
        reject(err);
      });

      proc.on('close', exitCode => {
        clearTimeout(timer);
        if (killed) {
          resolve({ success: false, output: stdout, error: 'Time Limit Exceeded (5s)' });
        } else if (exitCode !== 0) {
          resolve({ success: false, output: stdout, error: 'Runtime Error: ' + stderr });
        } else {
          resolve({ success: true, output: stdout, error: null });
        }
      });

      proc.stdin.write(String(input ?? ''));
      proc.stdin.end();
    });

    return result;

  } finally {
    try {
      if (fs.existsSync(sourcePath)) fs.unlinkSync(sourcePath);
      if (fs.existsSync(exePath)) fs.unlinkSync(exePath);
    } catch (_) { }
  }
}

module.exports = { runJudge, runWithCustomInput };
