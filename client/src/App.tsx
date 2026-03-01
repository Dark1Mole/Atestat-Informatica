import { useCallback, useEffect, useMemo, useState } from "react"
import Editor from "@monaco-editor/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Send, Check, X, Clock, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

const API = "/api"

type Problem = {
  id: number
  title: string
  timeLimit: number
  testsCount: number
  statement?: string
  category?: string
}

type VerdictResult = {
  verdict: string
  passedTests?: number
  totalTests?: number
  message?: string
  friendlyMessage?: string
  wrongOutput?: string
  expectedOutput?: string
  failedTest?: number
}

type Attempts = Record<
  number,
  {
    wrong: number
    compile: number
  }
>

const DEFAULT_CODE = `#include <iostream>
using namespace std;

int main() {
    int a, b;
    cin >> a >> b;
    cout << a + b;
    return 0;
}
`

function App() {
  const [problems, setProblems] = useState<Problem[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [code, setCode] = useState(DEFAULT_CODE)
  const [verdict, setVerdict] = useState<VerdictResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [editorReady, setEditorReady] = useState(false)
  const [attempts, setAttempts] = useState<Attempts>({})
  const [showTips, setShowTips] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("miniPbinfo.attempts")
      if (raw) {
        const parsed = JSON.parse(raw) as Attempts
        setAttempts(parsed)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem("miniPbinfo.attempts", JSON.stringify(attempts))
    } catch {
      // ignore
    }
  }, [attempts])

  const loadProblems = useCallback(async () => {
    try {
      const res = await fetch(`${API}/problems`)
      const data = await res.json()
      setProblems(data)
    } catch {
      setProblems([])
    }
  }, [])

  useEffect(() => {
    loadProblems()
  }, [loadProblems])

  useEffect(() => {
    if (problems.length === 0) return

    if (selectedId === null) {
      let initialId: number | null = null
      try {
        const stored = window.localStorage.getItem("miniPbinfo.selectedProblemId")
        if (stored) {
          const parsed = Number.parseInt(stored, 10)
          if (problems.some((p) => p.id === parsed)) {
            initialId = parsed
          }
        }
      } catch {
        initialId = null
      }
      if (initialId === null) {
        initialId = problems[0].id
      }
      setSelectedId(initialId)
    }
  }, [problems, selectedId])

  useEffect(() => {
    if (selectedId == null) return
    try {
      window.localStorage.setItem("miniPbinfo.selectedProblemId", String(selectedId))
    } catch {
      // ignore
    }
  }, [selectedId])

  useEffect(() => {
    if (selectedId == null) return
    try {
      const stored = window.localStorage.getItem(`miniPbinfo.code.${selectedId}`)
      if (stored != null) {
        setCode(stored)
      } else {
        setCode(DEFAULT_CODE)
      }
    } catch {
      setCode(DEFAULT_CODE)
    }
  }, [selectedId])

  useEffect(() => {
    if (selectedId == null) return
    try {
      window.localStorage.setItem(`miniPbinfo.code.${selectedId}`, code)
    } catch {
      // ignore
    }
  }, [selectedId, code])

  const currentProblem = useMemo(
    () => (selectedId != null ? problems.find((p) => p.id === selectedId) ?? null : null),
    [problems, selectedId]
  )

  const groupedProblems = useMemo(() => {
    const groups: Record<string, Problem[]> = {}
    for (const p of problems) {
      const key = p.category || "Fără categorie"
      if (!groups[key]) groups[key] = []
      groups[key].push(p)
    }
    Object.values(groups).forEach((arr) => arr.sort((a, b) => a.id - b.id))
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [problems])

  const handleResetCode = () => {
    if (!selectedId) return
    setCode(DEFAULT_CODE)
    setVerdict(null)
    try {
      window.localStorage.removeItem(`miniPbinfo.code.${selectedId}`)
    } catch {
      // ignore
    }
  }

  const currentAttempts =
    selectedId != null && attempts[selectedId]
      ? attempts[selectedId]
      : { wrong: 0, compile: 0 }

  const unlockedTipsCount =
    currentProblem && Array.isArray((currentProblem as any).tips)
      ? Math.min(
          ((currentProblem as any).tips as string[]).length,
          currentAttempts.wrong
        )
      : 0

  const handleSubmit = async () => {
    if (!selectedId || !editorReady) return
    setLoading(true)
    setVerdict({ verdict: "Running", passedTests: 0, totalTests: 0 })
    try {
      const res = await fetch(`${API}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: selectedId, code }),
      })
      const result: VerdictResult = await res.json()
      setVerdict(result)

      setAttempts((prev) => {
        if (!selectedId) return prev
        const current = prev[selectedId] ?? { wrong: 0, compile: 0 }
        const lower = (result.verdict || "").toLowerCase()
        const next = { ...current }
        if (lower.includes("wrong") || lower === "wa") {
          next.wrong += 1
        }
        if (lower.includes("compile") || lower === "ce") {
          next.compile += 1
        }
        return { ...prev, [selectedId]: next }
      })
    } catch (err) {
      setVerdict({
        verdict: "Internal Error",
        message: err instanceof Error ? err.message : "Eroare de rețea",
      })
    } finally {
      setLoading(false)
    }
  }

  const verdictVariant = (v: string) => {
    const lower = (v || "").toLowerCase()
    if (lower.includes("accepted") || lower === "ac") return "accepted"
    if (lower.includes("wrong") || lower === "wa") return "wrongAnswer"
    if (lower.includes("time") || lower === "tle") return "timeLimit"
    if (lower.includes("compile") || lower === "ce") return "compileError"
    return "secondary"
  }

  const verdictLabel = (v: string) => {
    const lower = (v || "").toLowerCase()
    if (lower.includes("accepted") || lower === "ac") return "Accepted"
    if (lower.includes("wrong") || lower === "wa") return "Wrong Answer"
    if (lower.includes("time") || lower === "tle") return "Time Limit Exceeded"
    if (lower.includes("compile") || lower === "ce") return "Compile Error"
    return v || "Unknown"
  }

  const verdictIcon = (v: string) => {
    const lower = (v || "").toLowerCase()
    if (lower.includes("accepted") || lower === "ac") return <Check className="size-5" />
    if (lower.includes("wrong") || lower === "wa") return <X className="size-5" />
    if (lower.includes("time") || lower === "tle") return <Clock className="size-5" />
    if (lower.includes("compile") || lower === "ce") return <AlertCircle className="size-5" />
    return null
  }

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
          {/* Sidebar: problems + statement */}
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
                      <p className="text-sm text-muted-foreground">Se încarcă...</p>
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
                                : "text-muted-foreground hover:bg-accent hover:text-foreground"
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
                        <span>Limită de timp: {currentProblem.timeLimit} ms</span>
                        <span>Teste: {currentProblem.testsCount}</span>
                      </div>
                      <div className="text-sm text-card-foreground/90 space-y-1 markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {currentProblem.statement || "Fără enunț."}
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
                    onMount={() => setEditorReady(true)}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      scrollBeyondLastLine: false,
                      padding: { top: 12 },
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

            {verdict && (
              <Card
                className={cn(
                  verdict.verdict?.toLowerCase().includes("accepted") && "border-emerald-500/50",
                  verdict.verdict?.toLowerCase().includes("wrong") && "border-red-500/50",
                  verdict.verdict?.toLowerCase().includes("time") && "border-amber-500/50",
                  verdict.verdict?.toLowerCase().includes("compile") && "border-violet-500/50"
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    {verdictIcon(verdict.verdict)}
                    <Badge variant={verdictVariant(verdict.verdict)}>
                      {verdictLabel(verdict.verdict)}
                    </Badge>
                    {(verdict.passedTests != null || verdict.totalTests != null) && (
                      <span className="text-sm text-muted-foreground">
                        {verdict.passedTests ?? 0} / {verdict.totalTests ?? 0} teste trecute
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
                            <p className="text-destructive break-all">{verdict.message}</p>
                          )}
                          {verdict.wrongOutput != null && (
                            <p>
                              <span className="text-red-400">Output tău:</span>{" "}
                              {String(verdict.wrongOutput).slice(0, 300)}
                            </p>
                          )}
                          {verdict.expectedOutput != null && (
                            <p>
                              <span className="text-emerald-400">Așteptat:</span>{" "}
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
                      Ai avut {currentAttempts.wrong} încercări greșite pentru această problemă. Fiecare
                      încercare deblochează un nou hint.
                    </p>
                    <div className="space-y-2">
                      {Array.from({ length: unlockedTipsCount }).map((_, index) => (
                        <div
                          key={index}
                          className="rounded-md border border-border/60 bg-card/40 px-3 py-2"
                        >
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                            Hint {index + 1}
                          </div>
                          <div className="text-card-foreground/90 text-sm">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {((currentProblem as any).tips as string[])[index]}
                            </ReactMarkdown>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
