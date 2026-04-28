# Mini-pbinfo | Atestat Informatică

Sistem de evaluare automată a soluțiilor C++ pentru atestat. Simplu, funcțional, explicabil.

## Cerințe

- **Node.js** (v16+)
- **g++** (MinGW pe Windows, gcc pe Linux/Mac)

## Rulare

```bash
npm install
cd client && npm install && cd ..
npm run build
npm start
```

Deschide http://localhost:3000 în browser.

**Dezvoltare:** rulezi backend (`npm start`) și client în paralel (`npm run dev:client`). Clientul folosește proxy către API.

## Tehnologii

- **Backend:** Node.js, Express
- **Frontend:** React, Vite, Tailwind, shadcn/ui, Monaco Editor (C++)

## Structură

```
/backend
  server.js      # Express API
  judge.js       # Judge C++ (g++, timeout)
  /problems/1..5
    problem.json
    /tests/*.in, *.out
/client          # React app (shadcn/ui)
  src/App.tsx, components/ui/
```

## Probleme incluse (exemple)

1. Suma a două numere
2. Verificare număr par
3. Maximul a trei numere
4. Factorial
5. Număr prim

## Cum sunt testate soluțiile

1. Codul C++ trimis este salvat într-un fișier temporar.
2. Este compilat cu `g++ -std=c++17 -O2`.
   - Dacă apare o eroare, verdictul este **Compile Error**, cu mesaj detaliat și un rezumat în limbaj natural.
3. Pentru fiecare test `i`:
   - programul este rulat cu inputul din `tests/i.in`, cu limită de timp (ex: `2000 ms`);
   - output-ul produs este citit și normalizat (se ignoră spațiile și diferențele de `\r\n`);
   - este comparat cu `tests/i.out`.
4. Primul test care eșuează oprește evaluarea:
   - **Wrong Answer** – output diferit față de așteptat;
   - **Time Limit Exceeded** – programul nu termină în timp util.
5. Dacă toate testele sunt trecute, verdictul este **Accepted**.

Toate trimiterile sunt logate în `backend/submissions.log` (timp, id problemă, verdict, teste trecute).

## Adăugare problemă nouă

1. Creează folder `backend/problems/N` (N = id)
2. Adaugă `problem.json`:

```json
{
  "id": N,
  "title": "Titlul problemei",
  "timeLimit": 2000,
  "testsCount": 5,
  "description": "Enunțul în format Markdown...",
  "category": "Introducere / Cicluri / ...",
  "tips": [
    "Hint 1 în format Markdown",
    "Hint 2..."
  ]
}
```

3. Adaugă `tests/1.in`, `tests/1.out`, etc.

### Markdown pentru enunț

Enunțurile suportă Markdown simplu:

- `**bold**` pentru evidențiere;
- liste cu `-` sau `1.` pentru enumerări;
- inline code cu `` `cod` `` și blocuri de cod cu ` `cpp ... ```;
- formule LaTeX simple între `\\( ... \\)` (opțional).

## Verdicturi

- **Accepted** – toate testele trecute
- **Wrong Answer** – output incorect
- **Time Limit Exceeded** – depășire timp
- **Compile Error** – eroare la compilare

## Deployment

### Local Development

```bash
npm install
cd client && npm install && cd ..
npm run dev:client      # Terminal 1: frontend on http://localhost:5173
npm start               # Terminal 2: backend on http://localhost:3000
```

Frontend proxy automatically forwards `/api` calls to the backend.

### Production Deployment

**Architecture:** Frontend on Vercel + Backend on Render

1. **Frontend (Vercel):**
   - Already configured in `vercel.json` and `client/vite.config.ts`
   - Redeploy: `vercel --prod`

2. **Backend (Render):**
   - See [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) for step-by-step instructions
   - TL;DR: Create Render Web Service pointing to this repo, set Start Command to `node backend/server.js`

3. **Connect them:**
   - Get your Render backend URL (e.g., `https://atestat-backend-xxxx.onrender.com`)
   - Set `VITE_API_URL` env var in Vercel to that URL
   - Redeploy Vercel frontend

### Why Local Dev Works, But Production Doesn't (Without This)

- **Local:** Vite proxy in `client/vite.config.ts` redirects `/api` calls to `http://localhost:3000`
- **Production:** Vercel frontend has no backend unless you deploy one separately
- **Solution:** Frontend reads `VITE_API_URL` to call the production backend URL

See [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) for full deployment guide.
