import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import {
  Activity,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Globe2,
  PackageCheck,
  RefreshCw,
  Server,
  ShoppingCart,
  Warehouse,
} from 'lucide-react';
import { db } from '../config/firebase';

const number = (value) => new Intl.NumberFormat('id-ID').format(Number(value) || 0);

function formatTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const unsubscribe = onValue(ref(db, 'stok_inbound_wh'), (snapshot) => {
      const rows = [];
      snapshot.forEach((soNode) => {
        const value = soNode.val() || {};
        const master = value.informasi_master || {};
        const cartons = value.karton || {};
        const cartonRows = Object.entries(cartons).map(([id, carton]) => ({
          id,
          ...carton,
        }));

        rows.push({
          id: soNode.key,
          so: soNode.key?.replace(/^SO_/, '') || '-',
          artikel: master.artikel || '-',
          destination: master.destination || '-',
          customer: master.wh_cust || '-',
          terakhir_update: master.terakhir_update || null,
          cartons: cartonRows,
        });
      });

      rows.sort((a, b) => new Date(b.terakhir_update || 0) - new Date(a.terakhir_update || 0));
      setOrders(rows);
      setLastUpdated(new Date());
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const metrics = useMemo(() => {
    const cartons = orders.flatMap((order) => order.cartons.map((carton) => ({ ...carton, so: order.so, artikel: order.artikel })));
    const totalPcs = cartons.reduce((sum, carton) => sum + (Number(carton.isi_karton) || 0), 0);
    const mix = cartons.filter((carton) => String(carton.size).toUpperCase() === 'MIX').length;
    const solid = cartons.length - mix;
    const destinations = new Set(orders.map((order) => order.destination).filter(Boolean));

    return {
      so: orders.length,
      cartons: cartons.length,
      pcs: totalPcs,
      mix,
      solid,
      destinations: destinations.size,
    };
  }, [orders]);

  const recentOrders = orders.slice(0, 6);

  return (
    <div className="max-w-[1500px] mx-auto space-y-6 pb-8">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary text-xs font-black uppercase tracking-[0.16em]">
            <Warehouse size={15} /> Finished Goods Warehouse
          </div>
          <h2 className="text-2xl font-black tracking-tight text-textMain mt-1">Inbound Overview</h2>
          <p className="text-sm font-medium text-textMuted mt-1">Real-time overview dari database Firebase WMS.</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-bold text-textMuted">
          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Firebase Live
          </span>
          <span className="px-3 py-2 rounded-xl bg-surface border border-borderLight">Updated {lastUpdated ? lastUpdated.toLocaleTimeString('id-ID') : '-'}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard icon={ShoppingCart} label="Active SO" value={number(metrics.so)} hint="Sales order tersimpan" tone="primary" />
        <MetricCard icon={Boxes} label="Total Carton" value={number(metrics.cartons)} hint={`${number(metrics.solid)} Solid · ${number(metrics.mix)} Mix`} tone="emerald" />
        <MetricCard icon={PackageCheck} label="Total Pieces" value={number(metrics.pcs)} hint="Isi carton ter-sync" tone="amber" />
        <MetricCard icon={Globe2} label="Destination" value={number(metrics.destinations)} hint="Destination terdaftar" tone="rose" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 bg-surface rounded-2xl border border-borderLight shadow-soft overflow-hidden">
          <div className="px-6 py-5 border-b border-borderLight flex items-center justify-between">
            <div>
              <h3 className="font-black text-textMain">Recent Inbound SO</h3>
              <p className="text-xs font-medium text-textMuted mt-1">Data terbaru berdasarkan terakhir_update dari Firebase.</p>
            </div>
            <Database size={19} className="text-primary" />
          </div>

          {loading ? <LoadingState /> : recentOrders.length === 0 ? <EmptyState /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-bgBody border-b border-borderLight">
                  <tr>
                    <th className="table-head">SO</th>
                    <th className="table-head">Article</th>
                    <th className="table-head">Destination</th>
                    <th className="table-head text-center">Carton</th>
                    <th className="table-head">Last Update</th>
                    <th className="table-head"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLight">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="table-cell font-black text-primary">{order.so}</td>
                      <td className="table-cell font-bold">{order.artikel}</td>
                      <td className="table-cell"><span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100"><Globe2 size={12} />{order.destination}</span></td>
                      <td className="table-cell text-center font-black">{number(order.cartons.length)}</td>
                      <td className="table-cell text-textMuted">{formatTime(order.terakhir_update)}</td>
                      <td className="table-cell text-right"><ChevronRight size={16} className="text-textMuted ml-auto" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="bg-surface rounded-2xl border border-borderLight shadow-soft overflow-hidden">
          <div className="px-6 py-5 border-b border-borderLight">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black">Database Health</h3>
                <p className="text-xs font-medium text-textMuted mt-1">Ringkasan struktur WMS Firebase.</p>
              </div>
              <Server size={19} className="text-secondary" />
            </div>
          </div>
          <div className="p-6 space-y-3">
            <HealthRow label="Firebase connection" value="Connected" good />
            <HealthRow label="SO master" value={`${number(metrics.so)} records`} />
            <HealthRow label="Karton nodes" value={`${number(metrics.cartons)} records`} />
            <HealthRow label="Solid / Mix" value={`${number(metrics.solid)} / ${number(metrics.mix)}`} />
            <HealthRow label="Destinations" value={`${number(metrics.destinations)} active`} />
          </div>
          <div className="mx-6 mb-6 rounded-xl bg-indigo-50 border border-indigo-100 p-4">
            <div className="flex items-start gap-3">
              <Activity size={18} className="text-primary mt-0.5" />
              <div>
                <p className="text-xs font-black text-indigo-900">Live database listener aktif</p>
                <p className="text-[11px] font-medium text-indigo-700 mt-1">Perubahan pada stok_inbound_wh akan langsung memperbarui dashboard.</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="bg-surface rounded-2xl border border-borderLight shadow-soft p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div>
            <h3 className="font-black">Inbound Distribution</h3>
            <p className="text-xs font-medium text-textMuted mt-1">Distribusi carton berdasarkan format yang tersimpan.</p>
          </div>
          <div className="flex gap-2 text-xs font-black">
            <span className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700">SOLID {number(metrics.solid)}</span>
            <span className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700">MIX {number(metrics.mix)}</span>
          </div>
        </div>
        <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex">
          <div className="bg-primary transition-all duration-500" style={{ width: `${metrics.cartons ? (metrics.solid / metrics.cartons) * 100 : 0}%` }} />
          <div className="bg-amber-400 transition-all duration-500" style={{ width: `${metrics.cartons ? (metrics.mix / metrics.cartons) * 100 : 0}%` }} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <MiniStat label="SO" value={number(metrics.so)} icon={ShoppingCart} />
          <MiniStat label="Carton" value={number(metrics.cartons)} icon={Boxes} />
          <MiniStat label="Pieces" value={number(metrics.pcs)} icon={PackageCheck} />
          <MiniStat label="Destinations" value={number(metrics.destinations)} icon={Globe2} />
        </div>
      </section>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, hint, tone }) {
  const tones = {
    primary: 'bg-indigo-50 text-primary',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  return (
    <div className="bg-surface rounded-2xl border border-borderLight shadow-soft p-5 hover:shadow-float transition-shadow">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tones[tone]}`}><Icon size={21} /></div>
      <p className="text-[10px] uppercase tracking-wider font-black text-textMuted mt-4">{label}</p>
      <div className="flex items-end justify-between gap-2 mt-1">
        <h3 className="text-2xl font-black tracking-tight">{value}</h3>
        <ArrowUpRight size={15} className="text-textMuted mb-1" />
      </div>
      <p className="text-[11px] font-semibold text-textMuted mt-1 truncate">{hint}</p>
    </div>
  );
}

function HealthRow({ label, value, good = false }) {
  return <div className="flex items-center justify-between rounded-xl bg-bgBody border border-borderLight px-4 py-3"><span className="text-xs font-bold text-textMuted">{label}</span><span className={`text-xs font-black flex items-center gap-1.5 ${good ? 'text-emerald-600' : 'text-textMain'}`}>{good && <CheckCircle2 size={13} />}{value}</span></div>;
}

function MiniStat({ label, value, icon: Icon }) {
  return <div className="rounded-xl border border-borderLight p-4 flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-bgBody flex items-center justify-center text-primary"><Icon size={17} /></div><div><p className="text-[10px] uppercase font-black text-textMuted">{label}</p><p className="text-lg font-black">{value}</p></div></div>;
}

function LoadingState() { return <div className="p-12 text-center text-sm font-bold text-textMuted"><RefreshCw size={20} className="animate-spin mx-auto mb-3" />Loading Firebase data...</div>; }
function EmptyState() { return <div className="p-12 text-center text-sm font-bold text-textMuted"><Clock3 size={20} className="mx-auto mb-3" />Belum ada data inbound.</div>; }
