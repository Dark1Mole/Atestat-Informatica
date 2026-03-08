const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { runJudge } = require('./judge');

const app = express();
const PORT = 3000;

const clientDist = path.join(__dirname, '../client/dist');
const frontendFallback = path.join(__dirname, '../frontend');
const staticDir = fs.existsSync(clientDist) ? clientDist : frontendFallback;

let problemsCache = null;

function loadProblemsCache() {
  const problemsDir = path.join(__dirname, 'problems');
  const dirs = fs.readdirSync(problemsDir).filter(p => {
    const full = path.join(problemsDir, p);
    return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'problem.json'));
  });

  problemsCache = dirs.map(dir => {
    const data = JSON.parse(fs.readFileSync(path.join(problemsDir, dir, 'problem.json'), 'utf8'));
    return data;
  }).sort((a, b) => a.id - b.id);
}

function logSubmission(problemId, result) {
  try {
    const logPath = path.join(__dirname, 'submissions.log');
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      problemId,
      verdict: result.verdict,
      passedTests: result.passedTests,
      totalTests: result.totalTests
    });
    fs.appendFileSync(logPath, line + '\n', 'utf8');
  } catch {
    // nu stricăm request-ul dacă logging-ul eșuează
  }
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(staticDir));

// Lista probleme (cache în memorie)
app.get('/api/problems', (req, res) => {
  try {
    if (!problemsCache) {
      loadProblemsCache();
    }
    res.json(problemsCache || []);
  } catch (err) {
    console.error('Eroare la încărcarea problemelor:', err);
    res.status(500).json({ error: 'Eroare la încărcarea problemelor' });
  }
});

// Trimite soluție
app.post('/api/submit', async (req, res) => {
  const { problemId, code } = req.body;

  if (!problemId || !code) {
    return res.status(400).json({ error: 'problemId și code sunt obligatorii' });
  }

  try {
    const result = await runJudge(problemId, code);
    logSubmission(problemId, result);
    res.json(result);
  } catch (err) {
    console.error('Judge error:', err);
    res.status(500).json({ error: 'Eroare la evaluare', verdict: 'Internal Error' });
  }
});

// Rulează cod cu input custom (fără testare pe teste)
app.post('/api/run', async (req, res) => {
  const { code, input } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'code este obligatoriu' });
  }

  try {
    const { runWithCustomInput } = require('./judge');
    const result = await runWithCustomInput(code, input || '');
    res.json(result);
  } catch (err) {
    console.error('Run error:', err);
    res.status(500).json({ error: 'Eroare la rulare', output: '', success: false });
  }
});

// SPA: serve index.html for non-API routes (React app)
if (staticDir === clientDist) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Mini-pbinfo rulează pe http://localhost:${PORT}`);
});
