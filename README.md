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

## Adăugare problemă nouă

1. Creează folder `backend/problems/N` (N = id)
2. Adaugă `problem.json`:
```json
{
  "id": N,
  "title": "Titlul problemei",
  "timeLimit": 2000,
  "testsCount": 5,
  "statement": "Enunțul..."
}
```
3. Adaugă `tests/1.in`, `tests/1.out`, etc.

## Verdicturi

- **Accepted** – toate testele trecute
- **Wrong Answer** – output incorect
- **Time Limit Exceeded** – depășire timp
- **Compile Error** – eroare la compilare
