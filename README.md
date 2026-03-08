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
