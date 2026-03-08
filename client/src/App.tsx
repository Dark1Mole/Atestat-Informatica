import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Send,
  Check,
  X,
  Clock,
  AlertCircle,
  Play,
  Sparkles,
  Save,
  Trash2,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API = "/api";

type Problem = {
  id: number;
  title: string;
  timeLimit: number;
  testsCount: number;
  description?: string;
  category?: string;
};

type VerdictResult = {
  verdict: string;
  passedTests?: number;
  totalTests?: number;
  message?: string;
  friendlyMessage?: string;
  wrongOutput?: string;
  expectedOutput?: string;
  failedTest?: number;
};

type RunResult = {
  success: boolean;
  output: string;
  error?: string;
  friendlyError?: string;
};

type Attempts = Record<
  number,
  {
    wrong: number;
    compile: number;
  }
>;

type SavedSolution = {
  id: string;
  name: string;
  code: string;
  timestamp: number;
};

type SavedSolutions = Record<number, SavedSolution[]>;

const MAX_SAVES_PER_PROBLEM = 5;

const DEFAULT_CODE = `#include <iostream>
using namespace std;

int main() {
    int a, b;
    cin >> a >> b;
    cout << a + b;
    return 0;
}
`;

function App() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [verdict, setVerdict] = useState<VerdictResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [attempts, setAttempts] = useState<Attempts>({});
  const [showTips, setShowTips] = useState(false);

  // Saved solutions state
  const [savedSolutions, setSavedSolutions] = useState<SavedSolutions>({});
  const [showSaves, setShowSaves] = useState(false);
  const [saveName, setSaveName] = useState("");

  // Custom input state
  const [customInput, setCustomInput] = useState("");
  const [customOutput, setCustomOutput] = useState<RunResult | null>(null);
  const [runLoading, setRunLoading] = useState(false);

  // IntelliSense state
  const [intellisenseEnabled, setIntellisenseEnabled] = useState(() => {
    try {
      const stored = window.localStorage.getItem("miniPbinfo.intellisense");
      return stored !== "false"; // default true
    } catch {
      return true;
    }
  });
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const completionProviderRef = useRef<{ dispose: () => void } | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("miniPbinfo.attempts");
      if (raw) {
        const parsed = JSON.parse(raw) as Attempts;
        setAttempts(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  // Load saved solutions from localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("miniPbinfo.savedSolutions");
      if (raw) {
        const parsed = JSON.parse(raw) as SavedSolutions;
        setSavedSolutions(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  // Save solutions to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(
        "miniPbinfo.savedSolutions",
        JSON.stringify(savedSolutions)
      );
    } catch {
      // ignore
    }
  }, [savedSolutions]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "miniPbinfo.attempts",
        JSON.stringify(attempts),
      );
    } catch {
      // ignore
    }
  }, [attempts]);

  const loadProblems = useCallback(async () => {
    try {
      const res = await fetch(`${API}/problems`);
      const data = await res.json();
      setProblems(data);
    } catch {
      setProblems([]);
    }
  }, []);

  useEffect(() => {
    loadProblems();
  }, [loadProblems]);

  useEffect(() => {
    if (problems.length === 0) return;

    if (selectedId === null) {
      let initialId: number | null = null;
      try {
        const stored = window.localStorage.getItem(
          "miniPbinfo.selectedProblemId",
        );
        if (stored) {
          const parsed = Number.parseInt(stored, 10);
          if (problems.some((p) => p.id === parsed)) {
            initialId = parsed;
          }
        }
      } catch {
        initialId = null;
      }
      if (initialId === null) {
        initialId = problems[0].id;
      }
      setSelectedId(initialId);
    }
  }, [problems, selectedId]);

  useEffect(() => {
    if (selectedId == null) return;
    try {
      window.localStorage.setItem(
        "miniPbinfo.selectedProblemId",
        String(selectedId),
      );
    } catch {
      // ignore
    }
  }, [selectedId]);

  useEffect(() => {
    if (selectedId == null) return;
    try {
      const stored = window.localStorage.getItem(
        `miniPbinfo.code.${selectedId}`,
      );
      if (stored != null) {
        setCode(stored);
      } else {
        setCode(DEFAULT_CODE);
      }
    } catch {
      setCode(DEFAULT_CODE);
    }
  }, [selectedId]);

  useEffect(() => {
    if (selectedId == null) return;
    try {
      window.localStorage.setItem(`miniPbinfo.code.${selectedId}`, code);
    } catch {
      // ignore
    }
  }, [selectedId, code]);

  // Load custom input from localStorage
  useEffect(() => {
    if (selectedId == null) return;
    try {
      const stored = window.localStorage.getItem(
        `miniPbinfo.input.${selectedId}`,
      );
      if (stored != null) {
        setCustomInput(stored);
      } else {
        setCustomInput("");
      }
    } catch {
      setCustomInput("");
    }
  }, [selectedId]);

  // Save custom input to localStorage
  useEffect(() => {
    if (selectedId == null) return;
    try {
      window.localStorage.setItem(
        `miniPbinfo.input.${selectedId}`,
        customInput,
      );
    } catch {
      // ignore
    }
  }, [selectedId, customInput]);

  const currentProblem = useMemo(
    () =>
      selectedId != null
        ? (problems.find((p) => p.id === selectedId) ?? null)
        : null,
    [problems, selectedId],
  );

  const groupedProblems = useMemo(() => {
    const groups: Record<string, Problem[]> = {};
    for (const p of problems) {
      const key = p.category || "Fără categorie";
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    Object.values(groups).forEach((arr) => arr.sort((a, b) => a.id - b.id));
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [problems]);

  const handleResetCode = () => {
    if (!selectedId) return;
    setCode(DEFAULT_CODE);
    setVerdict(null);
    setCustomOutput(null);
    try {
      window.localStorage.removeItem(`miniPbinfo.code.${selectedId}`);
    } catch {
      // ignore
    }
  };

  // Get saves for current problem
  const currentSaves = selectedId != null ? (savedSolutions[selectedId] || []) : [];

  // Save current solution
  const handleSaveSolution = () => {
    if (!selectedId || !code.trim()) return;
    const name = saveName.trim() || `Salvare ${currentSaves.length + 1}`;
    
    if (currentSaves.length >= MAX_SAVES_PER_PROBLEM) {
      alert(`Maxim ${MAX_SAVES_PER_PROBLEM} salvari per problema. Sterge una pentru a salva alta.`);
      return;
    }

    const newSave: SavedSolution = {
      id: Date.now().toString(),
      name,
      code,
      timestamp: Date.now(),
    };

    setSavedSolutions((prev) => ({
      ...prev,
      [selectedId]: [...(prev[selectedId] || []), newSave],
    }));
    setSaveName("");
  };

  // Load a saved solution
  const handleLoadSolution = (save: SavedSolution) => {
    setCode(save.code);
    setVerdict(null);
    setCustomOutput(null);
  };

  // Delete a saved solution
  const handleDeleteSolution = (saveId: string) => {
    if (!selectedId) return;
    setSavedSolutions((prev) => ({
      ...prev,
      [selectedId]: (prev[selectedId] || []).filter((s) => s.id !== saveId),
    }));
  };

  // Format timestamp
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("ro-RO", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleRun = async () => {
    if (!editorReady) return;
    setRunLoading(true);
    setCustomOutput(null);
    try {
      const res = await fetch(`${API}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, input: customInput }),
      });
      const result: RunResult = await res.json();
      setCustomOutput(result);
    } catch (err) {
      setCustomOutput({
        success: false,
        output: "",
        error: err instanceof Error ? err.message : "Eroare de rețea",
      });
    } finally {
      setRunLoading(false);
    }
  };

  // C++ IntelliSense suggestions
  const cppSuggestions = useMemo(
    () => [
      // String functions
      {
        label: "strlen",
        kind: 1,
        detail: "size_t strlen(const char* str)",
        documentation: "Returnează lungimea șirului de caractere (fără \\0)",
      },
      {
        label: "strcpy",
        kind: 1,
        detail: "char* strcpy(char* dest, const char* src)",
        documentation: "Copiază șirul src în dest",
      },
      {
        label: "strcat",
        kind: 1,
        detail: "char* strcat(char* dest, const char* src)",
        documentation: "Concatenează src la sfârșitul lui dest",
      },
      {
        label: "strcmp",
        kind: 1,
        detail: "int strcmp(const char* s1, const char* s2)",
        documentation: "Compară două șiruri. Returnează 0 dacă sunt egale",
      },
      {
        label: "strchr",
        kind: 1,
        detail: "char* strchr(const char* str, int c)",
        documentation: "Găsește prima apariție a caracterului c în str",
      },
      {
        label: "strstr",
        kind: 1,
        detail: "char* strstr(const char* str, const char* substr)",
        documentation: "Găsește prima apariție a subșirului în str",
      },
      {
        label: "strncpy",
        kind: 1,
        detail: "char* strncpy(char* dest, const char* src, size_t n)",
        documentation: "Copiază cel mult n caractere din src în dest",
      },
      {
        label: "strncat",
        kind: 1,
        detail: "char* strncat(char* dest, const char* src, size_t n)",
        documentation: "Concatenează cel mult n caractere din src",
      },
      {
        label: "strncmp",
        kind: 1,
        detail: "int strncmp(const char* s1, const char* s2, size_t n)",
        documentation: "Compară primele n caractere din două șiruri",
      },
      {
        label: "strrchr",
        kind: 1,
        detail: "char* strrchr(const char* str, int c)",
        documentation: "Găsește ultima apariție a caracterului c",
      },
      {
        label: "strtok",
        kind: 1,
        detail: "char* strtok(char* str, const char* delim)",
        documentation: "Împarte șirul în token-uri după delimitatori",
      },

      // Character functions
      {
        label: "isalpha",
        kind: 1,
        detail: "int isalpha(int c)",
        documentation: "Verifică dacă c este literă (a-z, A-Z)",
      },
      {
        label: "isdigit",
        kind: 1,
        detail: "int isdigit(int c)",
        documentation: "Verifică dacă c este cifră (0-9)",
      },
      {
        label: "isalnum",
        kind: 1,
        detail: "int isalnum(int c)",
        documentation: "Verifică dacă c este literă sau cifră",
      },
      {
        label: "isupper",
        kind: 1,
        detail: "int isupper(int c)",
        documentation: "Verifică dacă c este literă mare",
      },
      {
        label: "islower",
        kind: 1,
        detail: "int islower(int c)",
        documentation: "Verifică dacă c este literă mică",
      },
      {
        label: "isspace",
        kind: 1,
        detail: "int isspace(int c)",
        documentation: "Verifică dacă c este spațiu/tab/newline",
      },
      {
        label: "toupper",
        kind: 1,
        detail: "int toupper(int c)",
        documentation: "Convertește c la literă mare",
      },
      {
        label: "tolower",
        kind: 1,
        detail: "int tolower(int c)",
        documentation: "Convertește c la literă mică",
      },

      // Math functions
      {
        label: "sqrt",
        kind: 1,
        detail: "double sqrt(double x)",
        documentation: "Returnează rădăcina pătrată a lui x",
      },
      {
        label: "pow",
        kind: 1,
        detail: "double pow(double base, double exp)",
        documentation: "Returnează base^exp",
      },
      {
        label: "abs",
        kind: 1,
        detail: "int abs(int x)",
        documentation: "Returnează valoarea absolută a lui x",
      },
      {
        label: "fabs",
        kind: 1,
        detail: "double fabs(double x)",
        documentation: "Returnează valoarea absolută (pentru double)",
      },
      {
        label: "ceil",
        kind: 1,
        detail: "double ceil(double x)",
        documentation: "Rotunjește x în sus",
      },
      {
        label: "floor",
        kind: 1,
        detail: "double floor(double x)",
        documentation: "Rotunjește x în jos",
      },
      {
        label: "round",
        kind: 1,
        detail: "double round(double x)",
        documentation: "Rotunjește x la cel mai apropiat întreg",
      },
      {
        label: "sin",
        kind: 1,
        detail: "double sin(double x)",
        documentation: "Returnează sinusul lui x (radiani)",
      },
      {
        label: "cos",
        kind: 1,
        detail: "double cos(double x)",
        documentation: "Returnează cosinusul lui x (radiani)",
      },
      {
        label: "tan",
        kind: 1,
        detail: "double tan(double x)",
        documentation: "Returnează tangenta lui x (radiani)",
      },
      {
        label: "log",
        kind: 1,
        detail: "double log(double x)",
        documentation: "Returnează logaritmul natural (ln) al lui x",
      },
      {
        label: "log10",
        kind: 1,
        detail: "double log10(double x)",
        documentation: "Returnează logaritmul în baza 10 al lui x",
      },
      {
        label: "exp",
        kind: 1,
        detail: "double exp(double x)",
        documentation: "Returnează e^x",
      },

      // I/O functions
      {
        label: "cin",
        kind: 5,
        detail: "istream cin",
        documentation: "Citire de la tastatură (input stream)",
      },
      {
        label: "cout",
        kind: 5,
        detail: "ostream cout",
        documentation: "Afișare pe ecran (output stream)",
      },
      {
        label: "endl",
        kind: 5,
        detail: "manipulator endl",
        documentation: "Newline și flush buffer",
      },
      {
        label: "getline",
        kind: 1,
        detail: "istream& getline(istream& is, string& str)",
        documentation: "Citește o linie întreagă într-un string",
      },
      {
        label: "printf",
        kind: 1,
        detail: "int printf(const char* format, ...)",
        documentation: "Afișare formatată (stil C)",
      },
      {
        label: "scanf",
        kind: 1,
        detail: "int scanf(const char* format, ...)",
        documentation: "Citire formatată (stil C)",
      },
      {
        label: "gets",
        kind: 1,
        detail: "char* gets(char* str)",
        documentation: "Citește o linie (depreciat, folosește fgets)",
      },
      {
        label: "puts",
        kind: 1,
        detail: "int puts(const char* str)",
        documentation: "Afișează un șir și newline",
      },

      // Memory functions
      {
        label: "memset",
        kind: 1,
        detail: "void* memset(void* ptr, int value, size_t n)",
        documentation: "Setează n bytes la valoarea value",
      },
      {
        label: "memcpy",
        kind: 1,
        detail: "void* memcpy(void* dest, const void* src, size_t n)",
        documentation: "Copiază n bytes din src în dest",
      },
      {
        label: "malloc",
        kind: 1,
        detail: "void* malloc(size_t size)",
        documentation: "Alocă size bytes de memorie",
      },
      {
        label: "free",
        kind: 1,
        detail: "void free(void* ptr)",
        documentation: "Eliberează memoria alocată",
      },

      // Algorithm functions (C++ STL)
      {
        label: "sort",
        kind: 1,
        detail: "void sort(iterator first, iterator last)",
        documentation: "Sortează elementele în ordine crescătoare",
      },
      {
        label: "reverse",
        kind: 1,
        detail: "void reverse(iterator first, iterator last)",
        documentation: "Inversează ordinea elementelor",
      },
      {
        label: "find",
        kind: 1,
        detail: "iterator find(iterator first, iterator last, value)",
        documentation: "Caută o valoare în container",
      },
      {
        label: "count",
        kind: 1,
        detail: "int count(iterator first, iterator last, value)",
        documentation: "Numără aparițiile unei valori",
      },
      {
        label: "max",
        kind: 1,
        detail: "T max(T a, T b)",
        documentation: "Returnează maximul dintre a și b",
      },
      {
        label: "min",
        kind: 1,
        detail: "T min(T a, T b)",
        documentation: "Returnează minimul dintre a și b",
      },
      {
        label: "swap",
        kind: 1,
        detail: "void swap(T& a, T& b)",
        documentation: "Interschimbă valorile a și b",
      },
      {
        label: "max_element",
        kind: 1,
        detail: "iterator max_element(first, last)",
        documentation: "Returnează iterator la elementul maxim",
      },
      {
        label: "min_element",
        kind: 1,
        detail: "iterator min_element(first, last)",
        documentation: "Returnează iterator la elementul minim",
      },
      {
        label: "binary_search",
        kind: 1,
        detail: "bool binary_search(first, last, value)",
        documentation: "Căutare binară (vectorul trebuie sortat)",
      },
      {
        label: "lower_bound",
        kind: 1,
        detail: "iterator lower_bound(first, last, value)",
        documentation: "Primul element >= value",
      },
      {
        label: "upper_bound",
        kind: 1,
        detail: "iterator upper_bound(first, last, value)",
        documentation: "Primul element > value",
      },
      {
        label: "unique",
        kind: 1,
        detail: "iterator unique(first, last)",
        documentation: "Elimină duplicatele consecutive",
      },
      {
        label: "next_permutation",
        kind: 1,
        detail: "bool next_permutation(first, last)",
        documentation: "Generează următoarea permutare",
      },

      // Container methods
      {
        label: "push_back",
        kind: 2,
        detail: "void push_back(value)",
        documentation: "Adaugă element la sfârșitul vectorului",
      },
      {
        label: "pop_back",
        kind: 2,
        detail: "void pop_back()",
        documentation: "Șterge ultimul element",
      },
      {
        label: "size",
        kind: 2,
        detail: "size_t size()",
        documentation: "Returnează numărul de elemente",
      },
      {
        label: "empty",
        kind: 2,
        detail: "bool empty()",
        documentation: "Verifică dacă containerul este gol",
      },
      {
        label: "clear",
        kind: 2,
        detail: "void clear()",
        documentation: "Șterge toate elementele",
      },
      {
        label: "begin",
        kind: 2,
        detail: "iterator begin()",
        documentation: "Iterator la primul element",
      },
      {
        label: "end",
        kind: 2,
        detail: "iterator end()",
        documentation: "Iterator după ultimul element",
      },
      {
        label: "front",
        kind: 2,
        detail: "T& front()",
        documentation: "Referință la primul element",
      },
      {
        label: "back",
        kind: 2,
        detail: "T& back()",
        documentation: "Referință la ultimul element",
      },
      {
        label: "insert",
        kind: 2,
        detail: "iterator insert(pos, value)",
        documentation: "Inserează element la poziția pos",
      },
      {
        label: "erase",
        kind: 2,
        detail: "iterator erase(pos)",
        documentation: "Șterge elementul de la poziția pos",
      },
      {
        label: "resize",
        kind: 2,
        detail: "void resize(n)",
        documentation: "Redimensionează containerul",
      },

      // String methods (C++ string)
      {
        label: "length",
        kind: 2,
        detail: "size_t length()",
        documentation: "Lungimea string-ului",
      },
      {
        label: "substr",
        kind: 2,
        detail: "string substr(pos, len)",
        documentation: "Subșir de la pos cu lungimea len",
      },
      {
        label: "find",
        kind: 2,
        detail: "size_t find(str, pos)",
        documentation: "Găsește subșirul str începând de la pos",
      },
      {
        label: "replace",
        kind: 2,
        detail: "string& replace(pos, len, str)",
        documentation: "Înlocuiește len caractere de la pos cu str",
      },
      {
        label: "c_str",
        kind: 2,
        detail: "const char* c_str()",
        documentation: "Conversie la char* (stil C)",
      },
      {
        label: "append",
        kind: 2,
        detail: "string& append(str)",
        documentation: "Adaugă str la sfârșitul string-ului",
      },
      {
        label: "compare",
        kind: 2,
        detail: "int compare(str)",
        documentation: "Compară cu str (0 = egal)",
      },

      // Keywords and types
      {
        label: "int",
        kind: 14,
        detail: "tip întreg",
        documentation: "Număr întreg (4 bytes, ~±2 miliarde)",
      },
      {
        label: "long long",
        kind: 14,
        detail: "tip întreg mare",
        documentation: "Număr întreg mare (8 bytes, ~±9×10^18)",
      },
      {
        label: "double",
        kind: 14,
        detail: "tip real",
        documentation: "Număr real în virgulă mobilă",
      },
      {
        label: "char",
        kind: 14,
        detail: "tip caracter",
        documentation: "Un singur caracter (1 byte)",
      },
      {
        label: "bool",
        kind: 14,
        detail: "tip boolean",
        documentation: "true sau false",
      },
      {
        label: "string",
        kind: 7,
        detail: "clasa string",
        documentation: "Șir de caractere (C++ STL)",
      },
      {
        label: "vector",
        kind: 7,
        detail: "clasa vector<T>",
        documentation: "Vector dinamic (array redimensionabil)",
      },
      {
        label: "pair",
        kind: 7,
        detail: "clasa pair<T1,T2>",
        documentation: "Pereche de două valori",
      },
      {
        label: "map",
        kind: 7,
        detail: "clasa map<K,V>",
        documentation: "Dicționar ordonat (cheie-valoare)",
      },
      {
        label: "set",
        kind: 7,
        detail: "clasa set<T>",
        documentation: "Mulțime ordonată (fără duplicate)",
      },
      {
        label: "queue",
        kind: 7,
        detail: "clasa queue<T>",
        documentation: "Coadă (FIFO)",
      },
      {
        label: "stack",
        kind: 7,
        detail: "clasa stack<T>",
        documentation: "Stivă (LIFO)",
      },
      {
        label: "priority_queue",
        kind: 7,
        detail: "clasa priority_queue<T>",
        documentation: "Coadă cu priorități (heap)",
      },
    ],
    [],
  );

  const registerCppCompletions = useCallback(
    (monaco: Monaco) => {
      // Dispose previous provider if exists
      if (completionProviderRef.current) {
        completionProviderRef.current.dispose();
        completionProviderRef.current = null;
      }

      if (!intellisenseEnabled) return;

      const provider = monaco.languages.registerCompletionItemProvider("cpp", {
        provideCompletionItems: (
          model: editor.ITextModel,
          position: { lineNumber: number; column: number },
        ) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const suggestions = cppSuggestions.map((s) => ({
            label: s.label,
            kind: s.kind,
            detail: s.detail,
            documentation: s.documentation,
            insertText: s.label,
            range,
          }));

          return { suggestions };
        },
      });

      completionProviderRef.current = provider;
    },
    [intellisenseEnabled, cppSuggestions],
  );

  // Toggle IntelliSense
  const handleToggleIntellisense = useCallback(() => {
    setIntellisenseEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("miniPbinfo.intellisense", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Re-register completions when toggle changes
  useEffect(() => {
    if (monacoRef.current) {
      registerCppCompletions(monacoRef.current);
    }
  }, [intellisenseEnabled, registerCppCompletions]);

  // Editor mount handler
  const handleEditorMount = useCallback(
    (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      setEditorReady(true);
      editorRef.current = editor;
      monacoRef.current = monaco;
      registerCppCompletions(monaco);
    },
    [registerCppCompletions],
  );

  const currentAttempts =
    selectedId != null && attempts[selectedId]
      ? attempts[selectedId]
      : { wrong: 0, compile: 0 };

  const unlockedTipsCount =
    currentProblem && Array.isArray((currentProblem as any).tips)
      ? Math.min(
          ((currentProblem as any).tips as string[]).length,
          currentAttempts.wrong,
        )
      : 0;

  const handleSubmit = async () => {
    if (!selectedId || !editorReady) return;
    setLoading(true);
    setVerdict({ verdict: "Running", passedTests: 0, totalTests: 0 });
    try {
      const res = await fetch(`${API}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: selectedId, code }),
      });
      const result: VerdictResult = await res.json();
      setVerdict(result);

      setAttempts((prev) => {
        if (!selectedId) return prev;
        const current = prev[selectedId] ?? { wrong: 0, compile: 0 };
        const lower = (result.verdict || "").toLowerCase();
        const next = { ...current };
        if (lower.includes("wrong") || lower === "wa") {
          next.wrong += 1;
        }
        if (lower.includes("compile") || lower === "ce") {
          next.compile += 1;
        }
        return { ...prev, [selectedId]: next };
      });
    } catch (err) {
      setVerdict({
        verdict: "Internal Error",
        message: err instanceof Error ? err.message : "Eroare de rețea",
      });
    } finally {
      setLoading(false);
    }
  };

  const verdictVariant = (v: string) => {
    const lower = (v || "").toLowerCase();
    if (lower.includes("accepted") || lower === "ac") return "accepted";
    if (lower.includes("wrong") || lower === "wa") return "wrongAnswer";
    if (lower.includes("time") || lower === "tle") return "timeLimit";
    if (lower.includes("compile") || lower === "ce") return "compileError";
    return "secondary";
  };

  const verdictLabel = (v: string) => {
    const lower = (v || "").toLowerCase();
    if (lower.includes("accepted") || lower === "ac") return "Accepted";
    if (lower.includes("wrong") || lower === "wa") return "Wrong Answer";
    if (lower.includes("time") || lower === "tle") return "Time Limit Exceeded";
    if (lower.includes("compile") || lower === "ce") return "Compile Error";
    return v || "Unknown";
  };

  const verdictIcon = (v: string) => {
    const lower = (v || "").toLowerCase();
    if (lower.includes("accepted") || lower === "ac")
      return <Check className="size-5" />;
    if (lower.includes("wrong") || lower === "wa")
      return <X className="size-5" />;
    if (lower.includes("time") || lower === "tle")
      return <Clock className="size-5" />;
    if (lower.includes("compile") || lower === "ce")
      return <AlertCircle className="size-5" />;
    return null;
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary">Mini-pbinfo</h1>
          <span className="text-muted-foreground text-sm hidden sm:inline">
            Atestat Informatică • C++
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-4 md:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Sidebar: problems + description */}
          <aside className="space-y-4 order-2 lg:order-1">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Probleme
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-[180px] md:h-[220px]">
                  <div className="space-y-1 pr-2">
                    {problems.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Se încarcă...
                      </p>
                    )}
                    {groupedProblems.map(([category, items]) => (
                      <div key={category} className="space-y-1">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 px-1 pt-1">
                          {category}
                        </div>
                        {items.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setSelectedId(p.id)}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                              selectedId === p.id
                                ? "bg-primary/20 text-primary font-medium"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground",
                            )}
                          >
                            #{p.id} {p.title}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {currentProblem && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Enunț
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ScrollArea className="h-[200px] md:h-[280px]">
                    <div className="space-y-2 pr-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>Id: #{currentProblem.id}</span>
                        {currentProblem.category && (
                          <span className="rounded-full bg-accent/60 px-2 py-0.5">
                            {currentProblem.category}
                          </span>
                        )}
                        <span>
                          Limită de timp: {currentProblem.timeLimit} ms
                        </span>
                        <span>Teste: {currentProblem.testsCount}</span>
                      </div>
                      <div className="text-sm text-card-foreground/90 space-y-1 markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {currentProblem.description || "Fără enunț."}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </aside>

          {/* Editor + Verdict */}
          <div className="lg:col-span-2 space-y-4 order-1 lg:order-2">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Editor C++
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleSubmit}
                    disabled={loading || !selectedId}
                    size="sm"
                    className="shrink-0"
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Trimite
                  </Button>
                  <Button
                    type="button"
                    variant={intellisenseEnabled ? "default" : "outline"}
                    size="sm"
                    onClick={handleToggleIntellisense}
                    title={
                      intellisenseEnabled
                        ? "IntelliSense activat"
                        : "IntelliSense dezactivat"
                    }
                  >
                    <Sparkles className="size-4" />
                    {intellisenseEnabled
                      ? "IntelliSense ON"
                      : "IntelliSense OFF"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!selectedId || loading}
                    onClick={handleResetCode}
                  >
                    Resetare cod
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-lg border border-border overflow-hidden min-h-[280px] md:min-h-[320px]">
                  <Editor
                    height="280px"
                    defaultLanguage="cpp"
                    value={code}
                    onChange={(v) => setCode(v ?? "")}
                    onMount={handleEditorMount}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      scrollBeyondLastLine: false,
                      padding: { top: 12 },
                      quickSuggestions: intellisenseEnabled,
                      suggestOnTriggerCharacters: intellisenseEnabled,
                      wordBasedSuggestions: intellisenseEnabled
                        ? "currentDocument"
                        : "off",
                    }}
                  />
                </div>
                {currentProblem && (
                  <div className="mt-2 text-xs text-muted-foreground flex flex-wrap gap-2">
                    <span>Problemă #{currentProblem.id}</span>
                    <span>•</span>
                    <span>{currentProblem.testsCount} teste</span>
                    <span>•</span>
                    <span>limită {currentProblem.timeLimit} ms</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Custom Input/Output Section */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Testare manuală
                  </CardTitle>
                  <Button
                    onClick={handleRun}
                    disabled={runLoading || !editorReady}
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                  >
                    {runLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    Rulează
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Input (cin)
                    </label>
                    <textarea
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder="Introdu datele de intrare aici..."
                      className="w-full h-24 p-2 rounded-md border border-border bg-muted/30 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Output (cout)
                    </label>
                    <div className="w-full h-24 p-2 rounded-md border border-border bg-muted/50 text-sm font-mono overflow-auto">
                      {runLoading ? (
                        <span className="text-muted-foreground">
                          Se rulează...
                        </span>
                      ) : customOutput ? (
                        customOutput.success ? (
                          <pre className="whitespace-pre-wrap text-emerald-400">
                            {customOutput.output || "(gol)"}
                          </pre>
                        ) : (
                          <pre className="whitespace-pre-wrap text-red-400">
                            {customOutput.error ||
                              customOutput.friendlyError ||
                              "Eroare"}
                            {customOutput.output &&
                              `\n\nOutput parțial:\n${customOutput.output}`}
                          </pre>
                        )
                      ) : (
                        <span className="text-muted-foreground">
                          Apasă "Rulează" pentru a vedea output-ul
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {verdict && (
              <Card
                className={cn(
                  verdict.verdict?.toLowerCase().includes("accepted") &&
                    "border-emerald-500/50",
                  verdict.verdict?.toLowerCase().includes("wrong") &&
                    "border-red-500/50",
                  verdict.verdict?.toLowerCase().includes("time") &&
                    "border-amber-500/50",
                  verdict.verdict?.toLowerCase().includes("compile") &&
                    "border-violet-500/50",
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    {verdictIcon(verdict.verdict)}
                    <Badge variant={verdictVariant(verdict.verdict)}>
                      {verdictLabel(verdict.verdict)}
                    </Badge>
                    {(verdict.passedTests != null ||
                      verdict.totalTests != null) && (
                      <span className="text-sm text-muted-foreground">
                        {verdict.passedTests ?? 0} / {verdict.totalTests ?? 0}{" "}
                        teste trecute
                      </span>
                    )}
                  </div>
                </CardHeader>
                {(verdict.friendlyMessage ||
                  verdict.message ||
                  verdict.wrongOutput != null ||
                  verdict.expectedOutput != null) && (
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {verdict.friendlyMessage && (
                        <div className="rounded-md bg-muted/60 px-3 py-2 text-sm text-card-foreground">
                          {verdict.friendlyMessage}
                        </div>
                      )}
                      {(verdict.message ||
                        verdict.wrongOutput != null ||
                        verdict.expectedOutput != null) && (
                        <div className="rounded-md bg-muted/50 p-3 text-sm font-mono space-y-1">
                          {verdict.message && (
                            <p className="text-destructive break-all">
                              {verdict.message}
                            </p>
                          )}
                          {verdict.wrongOutput != null && (
                            <p>
                              <span className="text-red-400">Output tău:</span>{" "}
                              {String(verdict.wrongOutput).slice(0, 300)}
                            </p>
                          )}
                          {verdict.expectedOutput != null && (
                            <p>
                              <span className="text-emerald-400">
                                Așteptat:
                              </span>{" "}
                              {String(verdict.expectedOutput).slice(0, 300)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}
            {currentProblem && unlockedTipsCount > 0 && (
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Tips & tricks
                  </CardTitle>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowTips((v) => !v)}
                  >
                    {showTips ? "Ascunde" : "Arată"}
                  </Button>
                </CardHeader>
                {showTips && (
                  <CardContent className="pt-0 text-sm space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Ai avut {currentAttempts.wrong} încercări greșite pentru
                      această problemă. Fiecare încercare deblochează un nou
                      hint.
                    </p>
                    <div className="space-y-2">
                      {Array.from({ length: unlockedTipsCount }).map(
                        (_, index) => (
                          <div
                            key={index}
                            className="rounded-md border border-border/60 bg-card/40 px-3 py-2"
                          >
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                              Hint {index + 1}
                            </div>
                            <div className="text-card-foreground/90 text-sm">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {
                                  ((currentProblem as any).tips as string[])[
                                    index
                                  ]
                                }
                              </ReactMarkdown>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
