import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowUpRight, Box, FileText, Package, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

function formatNumber(value) { return Number(value || 0).toLocaleString('en-US'); }
function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try { setError(''); const result = await api.dashboard(); setData(result.data); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); const timer = setInterval(load, 30000); return () => clearInterval(timer); }, []);

  const rows = data?.recentSO || [];
  const summary = data?.summary || { totalSO: 0, totalCartons: 0, totalQty: 0 };
  const maxQty = Math.max(...rows.slice(0, 10).map((row) => row.qty), 1);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div><div className="flex items-center gap-2 text-primary mb-2"><Activity size={17}/><span className="text-[10px] uppercase tracking-[0.18em] font-black">Realtime Warehouse</span></div><h2 className="text-2xl font-black tracking-tight">Overview Inbound</h2><p className="text-xs font-semibold text-textMuted mt-1">Data is processed through the PPFG WMS API.</p></div>
        <div className={`flex items-center gap-2 text-[10px] font-bold ${error ? 'text-red-600' : 'text-textMuted'}`}><span className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : data ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`}/>{error ? 'API ERROR' : data ? `LIVE · ${formatDate(data.updatedAt)}` : 'CONNECTING'}</div>
      </section>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">{error}</div>}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard icon={FileText} label="Total SO" value={formatNumber(summary.totalSO)}/>
        <MetricCard icon={Package} label="Total Karton" value={formatNumber(summary.totalKarton)}/>
        <MetricCard icon={Box} label="Total Qty" value={formatNumber(summary.totalQty)} suffix="pcs"/>
      </section>
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 bg-surface border border-borderLight rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-6"><div><h3 className="font-black">Volume Inbound per SO</h3><p className="text-[10px] text-textMuted font-semibold mt-1">Latest SOs from the API</p></div><div className="text-[10px] font-black text-textMuted">QTY PCS</div></div>
          {loading ? <LoadingState/> : rows.length === 0 ? <EmptyState/> : <div className="space-y-4">{rows.slice(0,10).map(row => <div key={row.so} className="grid grid-cols-[82px_1fr_80px] items-center gap-3"><span className="text-[10px] font-black truncate">SO {row.so}</span><div className="h-8 rounded-lg bg-bgBody overflow-hidden"><div className="h-full rounded-lg bg-primary/90" style={{width:`${Math.max(3,(row.qty/maxQty)*100)}%`}}/></div><span className="text-[10px] font-black text-right">{formatNumber(row.qty)}</span></div>)}</div>}
        </div>
        <div className="bg-surface border border-borderLight rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4"><div><h3 className="font-black">Latest SOs</h3><p className="text-[10px] text-textMuted font-semibold mt-1">Latest inbound master records</p></div><ArrowUpRight size={17} className="text-primary"/></div>
          {loading ? <LoadingState/> : rows.length === 0 ? <EmptyState/> : <div className="space-y-3 max-h-[390px] overflow-auto pr-1">{rows.slice(0,8).map(row => <div key={row.so} className="rounded-xl border border-borderLight p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="inline-flex rounded-md bg-primary/10 text-primary px-2 py-1 text-[9px] font-black">SO {row.so}</span><p className="text-xs font-black truncate mt-2">{row.artikel}</p><p className="text-[9px] text-textMuted font-semibold truncate mt-0.5">{row.destination}</p></div><div className="text-right shrink-0"><p className="text-xs font-black">{formatNumber(row.cartons)}</p><p className="text-[9px] text-textMuted font-bold">karton</p></div></div><div className="mt-3 pt-2 border-t border-borderLight flex justify-between text-[9px] font-bold text-textMuted"><span>{formatNumber(row.qty)} pcs</span><span>{formatDate(row.lastUpdate)}</span></div></div>)}</div>}
        </div>
      </section>
      <section className="bg-surface border border-borderLight rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4"><div><h3 className="font-black">Inbound Master</h3><p className="text-[10px] text-textMuted font-semibold mt-1">Snapshot from the backend</p></div><button onClick={load} className="text-textMuted hover:text-primary"><RefreshCw size={16}/></button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-borderLight text-[9px] uppercase tracking-wider text-textMuted"><th className="py-3 pr-4">SO</th><th className="py-3 pr-4">Article</th><th className="py-3 pr-4">Destination</th><th className="py-3 pr-4">Karton</th><th className="py-3">Qty</th></tr></thead><tbody>{rows.slice(0,20).map(row => <tr key={row.so} className="border-b border-borderLight/70 last:border-0 text-xs"><td className="py-3 pr-4 font-black text-primary">{row.so}</td><td className="py-3 pr-4 font-bold">{row.artikel}</td><td className="py-3 pr-4 text-textMuted font-semibold">{row.destination}</td><td className="py-3 pr-4 font-black">{formatNumber(row.karton)}</td><td className="py-3 font-black">{formatNumber(row.qty)}</td></tr>)}</tbody></table>{!loading && rows.length===0 && <EmptyState/>}</div>
      </section>
    </div>
  );
}
function MetricCard({icon:Icon,label,value,suffix}){return <div className="bg-surface border border-borderLight rounded-2xl p-5 shadow-sm flex items-center gap-4"><div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Icon size={19}/></div><div><p className="text-[9px] uppercase tracking-wider font-black text-textMuted">{label}</p><p className="text-2xl font-black mt-1">{value} {suffix&&<span className="text-[10px] text-textMuted">{suffix}</span>}</p></div></div>}
function LoadingState(){return <div className="py-14 text-center text-xs font-bold text-textMuted">Loading data...</div>}
function EmptyState(){return <div className="py-14 text-center text-xs font-bold text-textMuted">No inbound data available.</div>}
