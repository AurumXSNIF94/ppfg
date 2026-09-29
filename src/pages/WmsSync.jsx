import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, Clock3, Database, PauseCircle, RefreshCw, RotateCcw, XCircle } from 'lucide-react';
import { getSyncStatus, startSync, stopSync } from '../config/gas';

function pct(index, total) {
  if (!total) return 0;
  return Math.min(100, Math.round((Number(index) / Number(total)) * 100));
}

function formatDate(value) {
  if (!value || value === '-') return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' });
}

export default function WmsSync() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const data = await getSyncStatus();
      setStatus(data);
      setError(data?.status === 'ERROR' ? data.error || 'Gagal mengambil status.' : '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const timer = setInterval(loadStatus, 15000);
    return () => clearInterval(timer);
  }, [loadStatus]);

  const progress = useMemo(() => pct(status?.progress, status?.total), [status]);
  const done = status?.cycleDone === true;
  const active = status?.syncActive === true;

  const runAction = async (fn, label) => {
    setAction(label);
    setError('');
    try {
      await fn();
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setAction('');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity size={20} className="text-primary" />
            <h2 className="text-xl font-extrabold">WMS Auto Sync</h2>
          </div>
          <p className="text-xs font-semibold text-textMuted mt-1">Monitoring sinkronisasi Google Sheets → Firebase.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => runAction(loadStatus, 'refresh')} disabled={!!action} className="px-4 py-2.5 rounded-xl border border-borderLight bg-surface text-xs font-bold flex items-center gap-2">
            <RefreshCw size={14} className={action === 'refresh' ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => runAction(startSync, 'start')} disabled={!!action || active} className="px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-50 flex items-center gap-2">
            <RotateCcw size={14} /> Mulai Cycle
          </button>
          <button onClick={() => runAction(stopSync, 'stop')} disabled={!!action || !active} className="px-4 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-100 text-xs font-bold disabled:opacity-50 flex items-center gap-2">
            <PauseCircle size={14} /> Stop
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">{error}</div>}

      {loading && !status ? (
        <div className="bg-surface border border-borderLight rounded-2xl p-10 text-center text-sm font-bold text-textMuted">Memuat status sync...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat icon={status?.autoSync ? CheckCircle2 : XCircle} label="Auto Sync" value={status?.autoSync ? 'AKTIF' : 'MATI'} good={status?.autoSync} />
            <Stat icon={active ? Activity : done ? CheckCircle2 : PauseCircle} label="Cycle" value={done ? 'SELESAI' : active ? 'BERJALAN' : 'IDLE'} good={done || active} />
            <Stat icon={Database} label="Progress" value={`${status?.progress || 0} / ${status?.total || 0}`} />
            <Stat icon={Clock3} label="Jadwal" value={status?.dailyStart || 'sekitar 23:00'} />
          </div>

          <section className="bg-surface border border-borderLight rounded-2xl p-6 shadow-sm">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-[10px] uppercase font-extrabold tracking-wider text-textMuted">Cycle Status</p>
                <h3 className="text-lg font-black mt-1">{status?.cycleStatus || 'TIDAK DIKETAHUI'}</h3>
              </div>
              <span className="text-2xl font-black text-primary">{progress}%</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-bold text-textMuted">
              <span>Last Sync: {formatDate(status?.lastSync)}</span>
              <span>Success: {status?.lastSyncSuccess ?? 0}</span>
              <span>Cycle Done: {done ? 'TRUE' : 'FALSE'}</span>
            </div>
          </section>

          <section className="bg-surface border border-borderLight rounded-2xl p-6 shadow-sm">
            <h3 className="font-extrabold mb-4">Status Detail</h3>
            <div className="grid md:grid-cols-2 gap-4 text-xs">
              <Info label="Auto Sync" value={String(status?.autoSync ?? false).toUpperCase()} />
              <Info label="Sync Active" value={String(active).toUpperCase()} />
              <Info label="Cycle Done" value={String(done).toUpperCase()} />
              <Info label="Last Error" value={status?.lastError || '-'} danger={!!status?.lastError} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, good }) {
  return <div className="bg-surface border border-borderLight rounded-2xl p-5 shadow-sm"><Icon size={18} className={good ? 'text-emerald-500' : 'text-primary'} /><p className="text-[10px] uppercase font-extrabold tracking-wider text-textMuted mt-3">{label}</p><p className="text-lg font-black mt-1">{value}</p></div>;
}

function Info({ label, value, danger }) {
  return <div className="rounded-xl bg-bgBody border border-borderLight p-4"><p className="text-[10px] uppercase font-extrabold text-textMuted">{label}</p><p className={`font-black mt-1 break-words ${danger ? 'text-red-600' : ''}`}>{value}</p></div>;
}
