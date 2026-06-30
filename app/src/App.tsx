import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import {
  Gauge, Wallet, Loader2, Plus, Activity, Hash, ChevronRight,
} from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'
import { NumberTicker } from './components/magic'

const EXPLORER = `https://explorer-bradbury.genlayer.com/contract/${CONTRACT}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

type Req = { id: string; requester: string; question: string; sources: string; tolerance_bps: number; state: string; value: string; unit: string; note: string }

export default function App() {
  const [wallet, setWallet] = useState<string | null>(null)
  const [stats, setStats] = useState({ total_requests: 0, resolved: 0 })
  const [reqs, setReqs] = useState<Req[]>([])
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState(''); const [sources, setSources] = useState(''); const [tol, setTol] = useState('100')
  const [creating, setCreating] = useState(false); const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    try {
      const s = (await read('stats')) as any
      setStats({ total_requests: Number(s?.total_requests ?? 0), resolved: Number(s?.resolved ?? 0) })
      const total = Number(s?.total_requests ?? 0); const out: Req[] = []
      for (let i = total - 1; i >= 0 && i >= total - 14; i--) { try { const r = (await read('get_request', [String(i)])) as any; if (r?.exists) out.push({ ...r, id: String(i) }) } catch {} }
      setReqs(out)
    } catch (e) { console.warn(e) }
  }
  useEffect(() => { load(); setWallet(isWalletConnected() ? 'connected' : null) /* eslint-disable-next-line */ }, [])

  async function connect() { try { const a = await connectWallet(); setWallet(a); toast.success(`Connected · ${short(a)}`) } catch (e: any) { toast.error(e?.message ?? 'Failed') } }
  async function request() { if (!question.trim()) return toast.error('Question required.'); const t = Number(tol); if (!(t >= 1 && t <= 5000)) return toast.error('Tolerance 1–5000 bps.'); setCreating(true); const to = toast.loading('Posting request…'); try { await write('request', [question.trim(), sources.trim(), Math.round(t)]); toast.success('Requested.', { id: to }); setQuestion(''); setSources(''); setOpen(false); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: to }) } finally { setCreating(false) } }
  async function resolve(r: Req) { setBusy(r.id); const to = toast.loading('Validators fetching + agreeing on a value… (30–60s)'); try { await write('resolve', [r.id]); const x = (await read('get_request', [r.id])) as any; toast.success(`Resolved: ${x?.value} ${x?.unit ?? ''}`, { id: to }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: to }) } finally { setBusy(null) } }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <Toaster theme="dark" position="top-right" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(720px_circle_at_50%_-5%,#22d3ee1c,transparent_60%)]" />

      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-2.5 px-5">
          <Gauge className="h-5 w-5 text-primary" /><span className="text-[15px] font-bold tracking-tight">NumOracle</span>
          <span className="ml-2 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">numeric feed</span>
          <div className="ml-4 hidden font-mono text-xs text-muted md:block"><b className="text-foreground"><NumberTicker value={stats.total_requests} /></b> requests · <b className="text-accent"><NumberTicker value={stats.resolved} /></b> resolved</div>
          <Button size="sm" className="ml-auto" variant={wallet ? 'outline' : 'primary'} onClick={connect}><Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect'}</Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8">
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">A number, agreed to within tolerance</h1>
        <p className="mt-1 text-sm text-muted">Validators fetch your sources independently and only settle when their readings agree within the band you set.</p>

        <div className="mt-5"><Button onClick={() => setOpen(!open)} variant={open ? 'ghost' : 'primary'}><Plus className="h-4 w-4" />{open ? 'Cancel' : 'New request'}</Button></div>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div className="mt-3 grid gap-2 rounded-xl border border-border bg-card/60 p-3">
              <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Numeric question — e.g. “ETH/USD spot price”" className="rounded-md border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary/50" />
              <input value={sources} onChange={(e) => setSources(e.target.value)} placeholder="Source URLs (space/comma)" className="rounded-md border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary/50" />
              <div className="flex items-center gap-3">
                <label className="font-mono text-xs text-muted">tolerance ±{(Number(tol) / 100).toFixed(2)}%</label>
                <input type="range" min={1} max={1000} value={tol} onChange={(e) => setTol(e.target.value)} className="flex-1 accent-primary" />
                <Button size="sm" onClick={request} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />} Request</Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* feed */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {reqs.length === 0 && <div className="col-span-full rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">No requests yet.</div>}
          {reqs.map((r) => {
            const resolved = r.state === 'resolved'
            return (
              <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card/55 p-4">
                <div className="flex items-center gap-2 font-mono text-[11px] text-muted"><Hash className="h-3 w-3" />{r.id} · ±{(r.tolerance_bps / 100).toFixed(2)}%</div>
                <p className="mt-1 text-sm font-medium">{r.question}</p>
                {resolved ? (
                  <div className="mt-3">
                    <div className="flex items-baseline gap-2"><span className="font-mono text-3xl font-black tabular-nums text-accent">{r.value}</span><span className="text-sm text-muted">{r.unit}</span></div>
                    {r.note && <p className="mt-1 text-[11px] text-muted">{r.note}</p>}
                  </div>
                ) : (
                  <div className="mt-3 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-primary"><Activity className="h-3.5 w-3.5 animate-pulse" /> awaiting consensus</span>
                    <Button size="sm" disabled={busy === r.id} onClick={() => resolve(r)}>{busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />} Resolve</Button>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </main>

      <footer className="border-t border-border"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 text-xs text-muted"><span>NumOracle · numeric consensus feed on GenLayer</span><a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></div></footer>
    </div>
  )
}
