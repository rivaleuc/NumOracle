import { useEffect, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { Loader2, Activity, ChevronRight } from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'

const EXPLORER = `https://explorer-bradbury.genlayer.com/contract/${CONTRACT}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
type Req = { id: string; question: string; sources: string; tolerance_bps: number; state: string; value: string; unit: string; note: string }

export default function App() {
  const [wallet, setWallet] = useState<string | null>(null)
  const [stats, setStats] = useState({ total_requests: 0, resolved: 0 })
  const [reqs, setReqs] = useState<Req[]>([]); const [sel, setSel] = useState<string | null>(null)
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
  async function request() { if (!question.trim()) return toast.error('Question.'); const t = Number(tol); if (!(t >= 1 && t <= 5000)) return toast.error('1–5000 bps'); setCreating(true); const to = toast.loading('posting…'); try { const id = (await write('request', [question.trim(), sources.trim(), Math.round(t)])) as any; toast.success('requested', { id: to }); setQuestion(''); setSources(''); await load(); if (typeof id === 'string') setSel(id) } catch (e: any) { toast.error(`failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: to }) } finally { setCreating(false) } }
  async function resolve(r: Req) { setBusy(r.id); const to = toast.loading('validators converging… (30–60s)'); try { await write('resolve', [r.id]); const x = (await read('get_request', [r.id])) as any; toast.success(`${x?.value} ${x?.unit ?? ''}`, { id: to }); await load() } catch (e: any) { toast.error(`failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: to }) } finally { setBusy(null) } }

  const r = reqs.find((x) => x.id === sel) || null
  const feed = reqs.filter((x) => x.state === 'resolved')

  return (
    <div className="min-h-screen bg-black p-3 text-foreground sm:p-6" style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
      <Toaster theme="dark" position="top-right" richColors />
      {/* terminal window */}
      <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        {/* title bar */}
        <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2.5">
          <span className="flex gap-1.5"><i className="h-3 w-3 rounded-full bg-[#ff5f56]" /><i className="h-3 w-3 rounded-full bg-[#ffbd2e]" /><i className="h-3 w-3 rounded-full bg-[#27c93f]" /></span>
          <span className="ml-2 text-xs text-muted">numoracle@bradbury — {stats.resolved}/{stats.total_requests} resolved</span>
          <button onClick={connect} className="ml-auto rounded border border-border px-2 py-0.5 text-[11px] hover:border-primary">{wallet && wallet !== 'connected' ? short(wallet) : wallet ? '● connected' : 'connect'}</button>
        </div>

        {/* ticker tape */}
        <div className="flex gap-6 overflow-x-auto border-b border-border bg-surface/50 px-4 py-1.5 text-[11px]">
          {feed.length === 0 ? <span className="text-muted">— awaiting first resolution —</span> : feed.map((x) => <button key={x.id} onClick={() => setSel(x.id)} className="flex shrink-0 items-center gap-2 whitespace-nowrap hover:text-primary"><span className="text-muted">{x.question.slice(0, 20)}</span><span className="font-bold text-accent">{x.value}</span><span className="text-muted">{x.unit}</span></button>)}
        </div>

        <div className="grid gap-px bg-border md:grid-cols-[1.5fr_1fr]">
          {/* readout */}
          <div className="bg-background p-6">
            {!r ? <div className="py-16 text-center text-sm text-muted">no requests — issue one →</div> : (<>
              <div className="text-[11px] text-muted">#{r.id} · ±{(r.tolerance_bps / 100).toFixed(2)}%</div>
              <div className="mt-1 text-sm text-muted">{r.question}</div>
              <div className="mt-6 flex items-end gap-3">{r.state === 'resolved' ? <><span className="text-6xl font-bold tabular-nums leading-none text-accent md:text-7xl">{r.value}</span><span className="mb-2 text-lg text-muted">{r.unit}</span></> : <span className="text-5xl font-bold tabular-nums leading-none text-muted/40">— — —</span>}</div>
              {r.state === 'resolved' ? (r.note && <p className="mt-4 border-l-2 border-primary/40 pl-3 text-xs text-muted">{r.note}</p>) : <Button className="mt-6" disabled={busy === r.id} onClick={() => resolve(r)}>{busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />} resolve</Button>}
            </>)}
          </div>
          {/* console + queue */}
          <div className="bg-surface/40">
            <div className="border-b border-border p-4">
              <div className="text-[11px] text-primary">$ request</div>
              <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="numeric question" className="mt-2 w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary/60" />
              <input value={sources} onChange={(e) => setSources(e.target.value)} placeholder="source urls" className="mt-2 w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary/60" />
              <div className="mt-2 flex items-center gap-2"><span className="text-[11px] text-muted">tol</span><input type="range" min={1} max={1000} value={tol} onChange={(e) => setTol(e.target.value)} className="flex-1 accent-primary" /><span className="w-12 text-right text-[11px] text-accent">±{(Number(tol) / 100).toFixed(1)}</span></div>
              <Button size="sm" className="mt-2 w-full" onClick={request} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />} submit</Button>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {reqs.map((x) => <button key={x.id} onClick={() => setSel(x.id)} className={`flex w-full items-center gap-2 px-4 py-2 text-left text-xs ${sel === x.id ? 'bg-primary/5' : 'hover:bg-white/[0.03]'}`}><span className="text-muted">{x.id}</span><span className="flex-1 truncate">{x.question}</span>{x.state === 'resolved' ? <span className="text-accent">{x.value}</span> : <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}</button>)}
            </div>
          </div>
        </div>
        <div className="border-t border-border bg-surface px-4 py-2 text-[11px] text-muted">numoracle · <a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></div>
      </div>
    </div>
  )
}
