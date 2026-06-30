import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import { Gauge, Wallet, Loader2, Activity, ChevronRight, Hash } from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'
import { NumberTicker } from './components/magic'

const EXPLORER = `https://explorer-bradbury.genlayer.com/contract/${CONTRACT}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
type Req = { id: string; question: string; sources: string; tolerance_bps: number; state: string; value: string; unit: string; note: string }

export default function App() {
  const [wallet, setWallet] = useState<string | null>(null)
  const [stats, setStats] = useState({ total_requests: 0, resolved: 0 })
  const [reqs, setReqs] = useState<Req[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [question, setQuestion] = useState(''); const [sources, setSources] = useState(''); const [tol, setTol] = useState('100')
  const [creating, setCreating] = useState(false); const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    try {
      const s = (await read('stats')) as any
      setStats({ total_requests: Number(s?.total_requests ?? 0), resolved: Number(s?.resolved ?? 0) })
      const total = Number(s?.total_requests ?? 0); const out: Req[] = []
      for (let i = total - 1; i >= 0 && i >= total - 20; i--) { try { const r = (await read('get_request', [String(i)])) as any; if (r?.exists) out.push({ ...r, id: String(i) }) } catch {} }
      setReqs(out); if (!sel && out.length) setSel(out[0].id)
    } catch (e) { console.warn(e) }
  }
  useEffect(() => { load(); setWallet(isWalletConnected() ? 'connected' : null) /* eslint-disable-next-line */ }, [])

  async function connect() { try { const a = await connectWallet(); setWallet(a); toast.success(`Connected · ${short(a)}`) } catch (e: any) { toast.error(e?.message ?? 'Failed') } }
  async function request() { if (!question.trim()) return toast.error('Question.'); const t = Number(tol); if (!(t >= 1 && t <= 5000)) return toast.error('Tol 1–5000 bps'); setCreating(true); const to = toast.loading('Posting…'); try { const id = (await write('request', [question.trim(), sources.trim(), Math.round(t)])) as any; toast.success('Requested.', { id: to }); setQuestion(''); setSources(''); await load(); if (typeof id === 'string') setSel(id) } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: to }) } finally { setCreating(false) } }
  async function resolve(r: Req) { setBusy(r.id); const to = toast.loading('Validators converging… (30–60s)'); try { await write('resolve', [r.id]); const x = (await read('get_request', [r.id])) as any; toast.success(`${x?.value} ${x?.unit ?? ''}`, { id: to }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: to }) } finally { setBusy(null) } }

  const r = reqs.find((x) => x.id === sel) || null
  const resolvedFeed = reqs.filter((x) => x.state === 'resolved')

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <Toaster theme="dark" position="top-right" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_circle_at_50%_-10%,#22d3ee18,transparent_60%)]" />

      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2.5 px-5 font-mono text-sm">
          <Gauge className="h-5 w-5 text-primary" /><span className="font-bold tracking-tight">num<span className="text-primary">oracle</span></span>
          <span className="ml-auto hidden text-xs text-muted sm:block">{stats.resolved}/{stats.total_requests} resolved</span>
          <Button size="sm" className="ml-3" variant={wallet ? 'outline' : 'primary'} onClick={connect}><Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect'}</Button>
        </div>
      </header>

      {/* ticker tape */}
      <div className="border-b border-border bg-card/40">
        <div className="mx-auto flex max-w-6xl gap-6 overflow-x-auto px-5 py-2 font-mono text-xs">
          {resolvedFeed.length === 0 ? <span className="text-muted">— awaiting first resolution —</span> : resolvedFeed.map((x) => (
            <button key={x.id} onClick={() => setSel(x.id)} className="flex shrink-0 items-center gap-2 whitespace-nowrap hover:text-primary"><span className="text-muted">{x.question.slice(0, 22)}</span><span className="font-bold text-accent">{x.value}</span><span className="text-muted">{x.unit}</span></button>
          ))}
        </div>
      </div>

      <main className="mx-auto grid max-w-6xl gap-5 px-5 py-7 lg:grid-cols-[1.5fr_1fr]">
        {/* big readout */}
        <section className="rounded-2xl border border-border bg-card/50 p-8">
          {!r ? <div className="py-16 text-center text-sm text-muted">No requests — issue one →</div> : (
            <>
              <div className="flex items-center gap-2 font-mono text-[11px] text-muted"><Hash className="h-3 w-3" />{r.id} · ±{(r.tolerance_bps / 100).toFixed(2)}% tolerance</div>
              <div className="mt-1 text-sm text-muted">{r.question}</div>
              <div className="mt-6 flex items-end gap-3">
                {r.state === 'resolved'
                  ? <><span className="font-mono text-6xl font-black tabular-nums leading-none text-accent md:text-7xl">{r.value}</span><span className="mb-2 text-lg text-muted">{r.unit}</span></>
                  : <span className="font-mono text-5xl font-black tabular-nums leading-none text-muted/40">— — —</span>}
              </div>
              {r.state === 'resolved'
                ? (r.note && <p className="mt-4 border-l-2 border-primary/40 pl-3 font-mono text-xs text-muted">{r.note}</p>)
                : <Button className="mt-6" disabled={busy === r.id} onClick={() => resolve(r)}>{busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />} Resolve by consensus</Button>}
            </>
          )}
        </section>

        {/* console + queue */}
        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-card/50 p-4 font-mono">
            <div className="text-[11px] text-primary">$ new request</div>
            <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="numeric question" className="mt-2 w-full rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
            <input value={sources} onChange={(e) => setSources(e.target.value)} placeholder="source URLs" className="mt-2 w-full rounded-md border border-border bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50" />
            <div className="mt-2 flex items-center gap-2"><span className="text-[11px] text-muted">tol</span><input type="range" min={1} max={1000} value={tol} onChange={(e) => setTol(e.target.value)} className="flex-1 accent-primary" /><span className="w-14 text-right text-[11px] text-accent">±{(Number(tol) / 100).toFixed(1)}%</span></div>
            <Button size="sm" className="mt-3 w-full" onClick={request} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />} submit</Button>
          </div>
          <div className="rounded-2xl border border-border bg-card/40">
            <div className="border-b border-border px-4 py-2 font-mono text-[11px] text-muted">queue</div>
            <div className="max-h-72 overflow-y-auto divide-y divide-border/60">
              {reqs.map((x) => (
                <button key={x.id} onClick={() => setSel(x.id)} className={`flex w-full items-center gap-2 px-4 py-2.5 text-left font-mono text-xs ${sel === x.id ? 'bg-primary/5' : 'hover:bg-white/[0.02]'}`}>
                  <span className="text-muted">{x.id}</span><span className="flex-1 truncate">{x.question}</span>
                  {x.state === 'resolved' ? <span className="text-accent">{x.value}</span> : <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-border"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 font-mono text-xs text-muted"><span>numoracle · numeric consensus feed</span><a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></div></footer>
    </div>
  )
}
