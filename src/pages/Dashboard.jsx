import { useEffect, useState } from 'react';
import {
  BarChart3, Box, Boxes,
  Globe2, Package, RefreshCw, TrendingUp, Warehouse
} from 'lucide-react';
import { api } from '../services/api';

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function percent(value) {
  return Math.max(0, Math.min(Number(value || 0), 100));
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      const result = await api.dashboard();
      setData(result.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  const summary = data?.summary || {};
  const rows = data?.recentSO || [];
  const destinations = data?.destinationStats || [];
  const articles = data?.articleStats || [];
  const sizes = data?.sizeStats || [];

  const maxSOQty = Math.max(...rows.slice(0, 10).map(row => Number(row.qty) || 0), 1);
  const maxDestinationQty = Math.max(...destinations.slice(0, 6).map(row => Number(row.qty) || 0), 1);
  const maxArticleQty = Math.max(...articles.slice(0, 6).map(row => Number(row.qty) || 0), 1);
  const maxSizeQty = Math.max(...sizes.slice(0, 8).map(row => Number(row.qty) || 0), 1);

  return (
    <div className="max-w-[1500px] mx-auto space-y-6 pb-8">
      <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary mb-2">
            <Warehouse size={17}/>
            <span className="text-[10px] uppercase tracking-[0.18em] font-black">Warehouse Control Center</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">Warehouse & Inventory Analytics</h2>
          <p className="text-xs font-semibold text-textMuted mt-1">
            Inbound volume, inventory flow, destination mix and warehouse activity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 text-[10px] font-bold ${error ? 'text-red-600' : 'text-textMuted'}`}>
            <span className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : data ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`}/>
            {error ? 'API ERROR' : data ? `LIVE · ${formatDate(data.updatedAt)}` : 'CONNECTING'}
          </div>
          <button onClick={load} className="p-2 rounded-lg border border-borderLight bg-surface text-textMuted hover:text-primary" title="Refresh dashboard">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>
          </button>
        </div>
      </section>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">{error}</div>}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        <MetricCard icon={Boxes} label="Active SO" value={formatNumber(summary.totalSO)}/>
        <MetricCard icon={Package} label="Total Cartons" value={formatNumber(summary.totalKarton)}/>
        <MetricCard icon={Box} label="Total Qty" value={formatNumber(summary.totalQty)} suffix="pcs"/>
        <MetricCard icon={BarChart3} label="Articles" value={formatNumber(summary.totalArticles)}/>
        <MetricCard icon={Globe2} label="Destinations" value={formatNumber(summary.totalDestinations)}/>
        <MetricCard icon={TrendingUp} label="Avg Qty / SO" value={formatNumber(summary.avgQtyPerSO)} suffix="pcs"/>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Panel title="Inbound by Destination" subtitle="Quantity distribution by destination" icon={Globe2}>
          <div className="space-y-4">
            {destinations.slice(0, 7).map(row => (
              <BarRow key={row.name} label={String(row.name).toUpperCase()} value={row.qty} max={maxDestinationQty}/>
            ))}
            {!destinations.length && <EmptyState/>}
          </div>
        </Panel>

        <Panel title="Inbound by Article" subtitle="Top article volume currently in warehouse" icon={Package}>
          <div className="space-y-4">
            {articles.slice(0, 7).map(row => (
              <BarRow key={row.name} label={row.name} value={row.qty} max={maxArticleQty}/>
            ))}
            {!articles.length && <EmptyState/>}
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Panel title="Size Distribution" subtitle="Quantity by size" icon={BarChart3}>
          <div className="grid grid-cols-2 gap-3">
            {sizes.slice(0, 8).map(row => (
              <div key={row.name} className="rounded-xl border border-borderLight p-3">
                <div className="flex items-center justify-between text-[10px] font-black">
                  <span>SIZE {row.name}</span><span>{formatNumber(row.qty)}</span>
                </div>
                <div className="h-2 rounded-full bg-bgBody mt-2 overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{width:`${Math.max(3, (row.qty / maxSizeQty) * 100)}%`}}/>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Inbound Volume by SO" subtitle="Highest current SO quantities" icon={BarChart3} className="xl:col-span-2">
          <div className="space-y-4">
            {rows.slice(0, 10).map(row => (
              <div key={row.so} className="grid grid-cols-[88px_1fr_90px] items-center gap-3">
                <span className="text-[10px] font-black truncate">SO {row.so}</span>
                <div className="h-8 rounded-lg bg-bgBody overflow-hidden">
                  <div className="h-full rounded-lg bg-primary/90" style={{width:`${Math.max(3, ((Number(row.qty) || 0) / maxSOQty) * 100)}%`}}/>
                </div>
                <span className="text-[10px] font-black text-right">{formatNumber(row.qty)} pcs</span>
              </div>
            ))}
            {!rows.length && <EmptyState/>}
          </div>
        </Panel>
      </section>

      <section className="bg-surface border border-borderLight rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div><h3 className="font-black">Warehouse Master Snapshot</h3><p className="text-[10px] text-textMuted font-semibold mt-1">Current active inbound inventory</p></div>
          <button onClick={load} className="text-textMuted hover:text-primary"><RefreshCw size={16}/></button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left">
            <thead><tr className="border-b border-borderLight text-[9px] uppercase tracking-wider text-textMuted">
              <th className="py-3 pr-4">SO</th><th className="py-3 pr-4">Article</th><th className="py-3 pr-4">Destination</th><th className="py-3 pr-4">Cartons</th><th className="py-3 pr-4">Qty</th><th className="py-3">Last Update</th>
            </tr></thead>
            <tbody>
              {rows.slice(0, 20).map(row => (
                <tr key={row.so} className="border-b border-borderLight/70 last:border-0 text-xs">
                  <td className="py-3 pr-4 font-black text-primary">{row.so}</td>
                  <td className="py-3 pr-4 font-bold">{row.artikel}</td>
                  <td className="py-3 pr-4 text-textMuted font-semibold">{String(row.destination || '-').toUpperCase()}</td>
                  <td className="py-3 pr-4 font-black">{formatNumber(row.karton)}</td>
                  <td className="py-3 pr-4 font-black">{formatNumber(row.qty)}</td>
                  <td className="py-3 text-textMuted">{formatDate(row.lastUpdate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !rows.length && <EmptyState/>}
        </div>
      </section>
    </div>
  );
}

function Panel({title, subtitle, icon:Icon, children, className=''}) {
  return (
    <section className={`bg-surface border border-borderLight rounded-2xl p-5 shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div><h3 className="font-black">{title}</h3><p className="text-[10px] text-textMuted font-semibold mt-1">{subtitle}</p></div>
        {Icon && <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Icon size={16}/></div>}
      </div>
      {children}
    </section>
  );
}

function MetricCard({icon:Icon,label,value,suffix}) {
  return (
    <div className="bg-surface border border-borderLight rounded-2xl p-4 shadow-sm flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Icon size={18}/></div>
      <div><p className="text-[9px] uppercase tracking-wider font-black text-textMuted">{label}</p><p className="text-xl font-black mt-1">{value} {suffix && <span className="text-[9px] text-textMuted">{suffix}</span>}</p></div>
    </div>
  );
}

function BarRow({label,value,max}) {
  const width = Math.max(3, Math.min((Number(value || 0) / Math.max(max, 1)) * 100, 100));
  return (
    <div>
      <div className="flex justify-between gap-3 text-[10px] font-black mb-1.5"><span className="truncate">{label}</span><span>{formatNumber(value)} pcs</span></div>
      <div className="h-3 rounded-full bg-bgBody overflow-hidden"><div className="h-full rounded-full bg-primary" style={{width:`${width}%`}}/></div>
    </div>
  );
}

function MiniStat({label,value,suffix=''}) {
  return <div className="rounded-xl bg-surface border border-borderLight p-3"><p className="text-[9px] uppercase tracking-wider font-black text-textMuted">{label}</p><p className="text-sm font-black mt-1">{value} {suffix && <span className="text-[8px] text-textMuted">{suffix}</span>}</p></div>;
}

function EmptyState({text='No inbound data available.'}){return <div className="py-10 text-center text-xs font-bold text-textMuted">{text}</div>;}
