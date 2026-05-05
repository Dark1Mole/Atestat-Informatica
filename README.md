# Mini-pbinfo | Atestat Informatică

Mini-pbinfo is a small online judge for C++ practice problems. It loads a list of problems, shows the statement, lets the user write code in Monaco Editor, runs the code against stored tests, and returns a verdict such as Accepted, Wrong Answer, Time Limit Exceeded, or Compile Error.

## What this project includes

- Problem browser with categories and problem statements.
- Monaco-based C++ editor with IntelliSense toggle.
- Submit flow that evaluates code against hidden tests in `backend/problems/*`.
- Manual run mode with custom input/output.
- Saved solutions per problem stored in `localStorage`.
- Default saved solutions seeded from the backend for problems 1 to 5.
- Responsive UI for mobile and desktop.
- Deployment setup for Vercel frontend + Render backend.

## Core workflow

1. The frontend loads the list of problems from the backend.
2. The user selects a problem and reads the statement.
3. The user writes C++ code in the editor.
4. The code can be:
    - submitted to the judge for full evaluation;
    - run with custom input for quick checking;
    - saved locally under a custom name.
5. The backend compiles and runs the code with `g++`.
6. The judge compares the program output with the expected outputs from the test files.

## Tech stack

- Backend: Node.js, Express, C++ judge runner.
- Frontend: React, Vite, TypeScript, Tailwind CSS, Framer Motion, Monaco Editor.
- Storage: `localStorage` for UI state and saved solutions; filesystem-based problem definitions and tests on the backend.
- Deployment: Vercel for frontend, Render for backend.

## Project structure

```text
/backend
   server.js
   judge.js
   default-saved-solutions.json
   submissions.log
   /problems
      /1..50
         problem.json
         /tests
            1.in
            1.out
            ...
/client
   src/App.tsx
   src/index.css
   src/main.tsx
   vite.config.ts
/frontend
   index.html
   app.js
```

The React client is the main interface. The `frontend/` folder is a legacy static version kept for compatibility and fallback use.

## Main user features

- Problem list grouped by category.
- Problem statement rendered as Markdown.
- C++ code editor with syntax highlighting.
- IntelliSense switch for editor suggestions.
- Submit button for automated grading.
- Custom input panel for ad hoc testing.
- Saved solutions panel for personal drafts.
- Default saves for problems 1 through 5 loaded from the backend.
- Mobile layout that keeps the problem statement visible before the editor.

## Judge behavior

The backend judge in [backend/judge.js](backend/judge.js) does the following:

1. Reads the problem definition from `backend/problems/<id>/problem.json`.
2. Validates basic limits such as code size and banned includes.
3. Writes the submitted code to a temporary `.cpp` file.
4. Compiles with:

```bash
g++ -std=c++17 -O2
```

5. Runs the compiled binary against each test input.
6. Stops on the first failing test.
7. Returns one of the following verdicts:
    - Accepted
    - Wrong Answer
    - Time Limit Exceeded
    - Compile Error
    - Internal Error

Output is normalized before comparison, so `\r\n` vs `\n` differences do not matter.

## Saved solutions system

Saved solutions are stored in the browser under `miniPbinfo.savedSolutions`.

- Each problem can have multiple saved snippets.
- Saves are capped per problem in the UI.
- The backend now exposes default seed saves through `GET /api/default-saves`.
- Those defaults are merged on first load if the user does not already have saves for that problem.

This makes problems 1 to 5 come with example solutions even on a fresh browser profile.

## Security notes

This project executes user-submitted C++ on the server, so security matters.

Implemented protections:

- Code size limit before compilation.
- Banned include list for risky headers such as `windows.h` and `filesystem`.
- Per-test timeout.
- Output truncation to avoid huge responses.
- Input validation for problem IDs.
- Restricted CORS allowlist instead of open `*` access.
- Process-tree cleanup on timeout so child processes are not left behind.

Important limitation:

- The judge is still not a full sandbox.
- It should not be treated as safe for hostile public traffic without containerization or VM isolation.
- A real production-safe setup would run the judge in Docker, a jail, or another isolated environment with CPU, memory, filesystem, and network restrictions.

## Scalability notes

The current architecture is fine for a school project, demos, or light classroom usage, but it has clear limits.

Current constraints:

- Each submission compiles code separately.
- The judge uses the host machine’s `g++` toolchain.
- Test execution is sequential per submission.
- Problem definitions are read from the filesystem.
- The backend is a single Node process.

What this means:

- A small number of concurrent users is fine.
- Heavy traffic will create compile bottlenecks.
- Large-scale use would need queues, worker processes, caching, and a sandboxed execution layer.

If you wanted to scale it properly, the next steps would be:

1. Move code execution into isolated workers or containers.
2. Add a queue for submissions.
3. Cache problem metadata in memory or in a database.
4. Store saves and submissions in a database instead of the browser/log file.
5. Add rate limiting and auth if the app becomes public.

## Local development

Requirements:

- Node.js 20.19+ or 22.12+ recommended.
- `g++` installed locally.

Install dependencies:

```bash
npm install
cd client
npm install
cd ..
```

Run the backend and frontend in separate terminals:

```bash
npm start
```

```bash
npm run dev:client
```

The client dev server uses the Vite proxy to forward `/api` requests to the backend during local development.

## Production deployment

The intended deployment is:

- Frontend on Vercel.
- Backend on Render.

Why this split exists:

- Vite injects `VITE_` variables at build time.
- Vercel serves the static frontend.
- The backend judge needs a runtime environment with `g++`.

Deployment steps:

1. Deploy the backend to Render.
2. Copy the Render URL.
3. Set `VITE_API_URL` in Vercel to the Render backend URL.
4. Redeploy the Vercel frontend.

See [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) for the full backend deployment guide.

## Adding a new problem

1. Create `backend/problems/<id>`.
2. Add a `problem.json` file with the problem metadata.
3. Add `tests/*.in` and `tests/*.out` files.
4. Make sure `testsCount` matches the test files you created.
5. Reload the app or restart the backend so the problem list is picked up.

Minimal `problem.json` shape:

```json
{
   "id": 1,
   "title": "Example",
   "category": "Șiruri de caractere",
   "timeLimit": 1000,
   "testsCount": 5,
   "description": "Problem statement in Markdown",
   "tips": ["Hint 1", "Hint 2"]
}
```

## FAQ

### Why does local development work with `/api`, but production needs `VITE_API_URL`?

Because the Vite dev server uses a proxy to forward requests to the backend. In production, the frontend is static and does not automatically know where the API lives, so the backend URL has to be injected at build time.

### Why is the judge not fully safe for arbitrary public users?

Because it executes compiled user code on the host machine. Even with timeouts and basic validation, true isolation requires a sandbox.

### Why does the backend need `g++`?

Because the judge compiles submitted solutions as C++ before running them.

### Are saved solutions shared between users?

No. Saved solutions are browser-local in `localStorage` unless you build a database-backed save system.

### Can this handle a lot of simultaneous submissions?

Not without additional infrastructure. Each submission compiles and runs code, so it will bottleneck under load.

### What happens if a solution times out?

The judge returns `Time Limit Exceeded` and kills the whole spawned process tree.

### Can I use this as a template for other judges?

Yes. The architecture is simple and easy to adapt, but you should add sandboxing before exposing it publicly.

## Common verdicts

- Accepted: all tests passed.
- Wrong Answer: output differed from the expected result.
- Time Limit Exceeded: the program did not finish in time.
- Compile Error: the code failed to compile.
- Internal Error: the backend could not complete the request.

## Notes on the problem set

The repository currently contains a larger set of numbered problems under `backend/problems/`. Problems 1 to 5 also have backend-seeded default saves so the interface can show example solutions immediately.

## License / usage

This project was built as an atestat / school project and is intended for educational use.
