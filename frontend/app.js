const API = 'http://localhost:3000/api';
let editor;
let currentProblemId = null;

const DEFAULT_CODE = `#include <iostream>
using namespace std;

int main() {
    int a, b;
    cin >> a >> b;
    cout << a + b;
    return 0;
}`;

// Monaco Editor
require.config({
  paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' },
  'vs/nls': { availableLanguages: { '*': 'ro' } }
});

require(['vs/editor/editor.main'], function () {
  editor = monaco.editor.create(document.getElementById('editor'), {
    value: DEFAULT_CODE,
    language: 'cpp',
    theme: 'vs-dark',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 14,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    padding: { top: 12 }
  });
});

// Încarcă probleme
async function loadProblems() {
  const listEl = document.getElementById('problem-list');
  try {
    const res = await fetch(`${API}/problems`);
    const problems = await res.json();

    listEl.innerHTML = problems.map(p => `
      <button data-id="${p.id}" class="problem-btn w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 transition text-slate-300 hover:text-white problem-item">
        #${p.id} ${p.title}
      </button>
    `).join('');

    document.querySelectorAll('.problem-btn').forEach(btn => {
      btn.addEventListener('click', () => selectProblem(parseInt(btn.dataset.id)));
    });

    if (problems.length > 0) selectProblem(problems[0].id);
  } catch (err) {
    listEl.innerHTML = '<div class="text-red-400 text-sm">Eroare la încărcare</div>';
  }
}

async function selectProblem(id) {
  currentProblemId = id;
  document.querySelectorAll('.problem-item').forEach(el => el.classList.remove('bg-emerald-900/30', 'text-emerald-400'));
  document.querySelector(`[data-id="${id}"]`)?.classList.add('bg-emerald-900/30', 'text-emerald-400');

  try {
    const res = await fetch(`${API}/problems/${id}`);
    const problem = await res.json();

    const panel = document.getElementById('problem-statement');
    const content = document.getElementById('statement-content');
    content.textContent = problem.statement || 'Fără enunț.';
    panel.classList.remove('hidden');
  } catch (_) {}
}

function setVerdict(result) {
  const panel = document.getElementById('verdict-panel');
  const card = document.getElementById('verdict-card');
  const icon = document.getElementById('verdict-icon');
  const text = document.getElementById('verdict-text');
  const stats = document.getElementById('verdict-stats');
  const details = document.getElementById('verdict-details');

  panel.classList.remove('hidden');
  card.className = 'rounded-xl p-6 text-white shadow-lg ';

  const v = (result.verdict || '').toLowerCase();
  if (v.includes('accepted') || v === 'ac') {
    card.classList.add('verdict-ac');
    icon.textContent = '✓';
    text.textContent = 'Accepted';
  } else if (v.includes('wrong') || v === 'wa') {
    card.classList.add('verdict-wa');
    icon.textContent = '✗';
    text.textContent = 'Wrong Answer';
  } else if (v.includes('time') || v === 'tle') {
    card.classList.add('verdict-tle');
    icon.textContent = '⏱';
    text.textContent = 'Time Limit Exceeded';
  } else if (v.includes('compile') || v === 'ce') {
    card.classList.add('verdict-ce');
    icon.textContent = '!';
    text.textContent = 'Compile Error';
  } else {
    card.classList.add('bg-slate-700');
    icon.textContent = '?';
    text.textContent = result.verdict || 'Unknown';
  }

  const passed = result.passedTests ?? 0;
  const total = result.totalTests ?? 0;
  stats.textContent = `${passed} / ${total} teste trecute`;

  details.classList.add('hidden');
  if (result.message) {
    details.classList.remove('hidden');
    details.textContent = result.message;
  } else if (result.wrongOutput != null || result.expectedOutput != null) {
    details.classList.remove('hidden');
    details.innerHTML = '';
    if (result.wrongOutput != null) {
      const p = document.createElement('p');
      p.innerHTML = '<span class="text-red-300">Output tău:</span> ' + escapeHtml(String(result.wrongOutput));
      details.appendChild(p);
    }
    if (result.expectedOutput != null) {
      const p = document.createElement('p');
      p.innerHTML = '<span class="text-green-300">Așteptat:</span> ' + escapeHtml(String(result.expectedOutput));
      details.appendChild(p);
    }
  }
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

document.getElementById('btn-submit').addEventListener('click', async () => {
  if (!currentProblemId || !editor) return;
  const btn = document.getElementById('btn-submit');
  btn.disabled = true;
  btn.textContent = 'Se evaluează...';

  setVerdict({ verdict: 'Running', passedTests: 0, totalTests: 0 });

  try {
    const res = await fetch(`${API}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problemId: currentProblemId, code: editor.getValue() })
    });
    const result = await res.json();
    setVerdict(result);
  } catch (err) {
    setVerdict({ verdict: 'Internal Error', message: err.message });
  } finally {
    btn.disabled = false;
    btn.textContent = 'Trimite';
  }
});

// Start
loadProblems();
