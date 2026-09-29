import { useEffect, useState } from 'react';
import { CheckCircle, Clock, Plus, RefreshCw, Search, Trash2, X, CloudDownload } from 'lucide-react';
import { api } from '../services/api';

function normalizeSheetPayload(payload) {
  const raw = Array.isArray(payload) ? payload : (payload?.data ?? payload?.rows ?? payload?.result ?? payload);
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];

  if (Array.isArray(raw.data)) return raw.data;

  // Support GAS responses keyed by SO, e.g. { "SO123": { article: "...", target: 100 } }.
  return Object.entries(raw).map(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return { ...value, so_number: value.so_number ?? value.so ?? value.SONumber ?? key };
    }
    return { so_number: key, value };
  });
}

function pick(row, keys) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && String(row[key]).trim() !== '') return row[key];
  }
  return '';
}

function extractSheetRow(payload, so) {
  const wanted = String(so || '').toUpperCase().replace(/^SO_/, '').trim();
  const rows = normalizeSheetPayload(payload);
  const match = rows.find(row => {
    const value = String(pick(row, ['so','SO','so_number','SONumber','nomor_so','No SO','NO SO']) || '')
      .toUpperCase().replace(/^SO_/, '').trim();
    return value === wanted;
  });
  return match || rows[0] || null;
}

export default function Planning() {
  const [rows,setRows]=useState([]);
  const [term,setTerm]=useState('');
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(true);
  const [pulling,setPulling]=useState(false);
  const [pullStatus,setPullStatus]=useState('');
  const [form,setForm]=useState({so_number:'',artikel:'',target_qty:''});

  const load=async()=>{
    try{setLoading(true);const r=await api.planning.list();setRows(r.data||[])}
    catch(e){alert(e.message)}
    finally{setLoading(false)}
  };

  useEffect(()=>{load()},[]);

  const pullFromSheets=async()=>{
    if(!form.so_number)return setPullStatus('❌ Please enter an SO number first.');
    setPulling(true);
    setPullStatus('⏳ Pulling data from Google Sheets...');
    try{
      const payload=await api.planning.pullFromSheets(form.so_number);
      const row=extractSheetRow(payload,form.so_number);
      if(!row) throw new Error('SO data was not found in Google Sheets. Please check the SO number.');
      const so=pick(row,['so','SO','so_number','SONumber','nomor_so']) || form.so_number;
      const artikel=pick(row,['artikel','Article','article','style','style_code']);
      const target=pick(row,['target_qty','targetQty','Target Qty','target','qty','quantity','total_qty','Total Qty','planned_qty','planning_qty']);
      setForm(prev=>({
        ...prev,
        so_number:String(so).toUpperCase(),
        artikel:String(artikel||prev.artikel).toUpperCase(),
        target_qty:target!==''?String(target).replace(/[^0-9.]/g,''):prev.target_qty
      }));
      setPullStatus('✅ Planning data successfully pulled from Google Sheets.');
    }catch(e){setPullStatus('❌ '+e.message)}
    finally{setPulling(false)}
  };

  const save=async(e)=>{
    e.preventDefault();
    try{await api.planning.create(form);setForm({so_number:'',artikel:'',target_qty:''});setPullStatus('');setOpen(false);await load()}
    catch(e){alert(e.message)}
  };

  const remove=async(id)=>{
    if(!confirm('Delete this planning target?'))return;
    try{await api.planning.remove(id);await load()}catch(e){alert(e.message)}
  };

  const filtered=rows.filter(r=>{
    const q=term.toUpperCase().trim();
    return !q||[r.so_number,r.artikel].some(v=>String(v||'').toUpperCase().includes(q))
  });

  return <div className="max-w-7xl mx-auto space-y-5">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div><h2 className="text-xl font-black">SO Planning</h2><p className="text-xs font-semibold text-textMuted mt-1">Plan inbound targets and compare them with actual warehouse quantity.</p></div>
      <div className="flex gap-2">
        <div className="relative w-full md:w-72"><Search size={15} className="absolute left-3.5 top-3 text-textMuted"/><input className="form-input pl-10 uppercase" placeholder="Search SO or Article..." value={term} onChange={e=>setTerm(e.target.value)}/></div>
        <button onClick={load} className="px-3 rounded-xl border border-borderLight bg-surface" title="Refresh"><RefreshCw size={16} className={loading?'animate-spin':''}/></button>
        <button onClick={()=>{setOpen(true);setPullStatus('')}} className="btn-primary flex items-center gap-2 text-xs"><Plus size={15}/> Add Target</button>
      </div>
    </div>

    <div className="bg-surface border border-borderLight rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead><tr className="bg-bgBody border-b border-borderLight text-[10px] uppercase text-textMuted">
            <th className="px-6 py-4 text-left">SO</th><th className="px-6 py-4 text-left">Article</th><th className="px-6 py-4 text-center">Target</th><th className="px-6 py-4 text-center">Actual</th><th className="px-6 py-4 text-center">Shortage</th><th className="px-6 py-4">Progress</th><th className="px-6 py-4 text-center">Status</th><th className="px-6 py-4 text-right">Action</th>
          </tr></thead>
          <tbody className="divide-y divide-borderLight">
            {loading?<tr><td colSpan="8" className="py-14 text-center text-xs font-bold text-textMuted">Loading planning...</td></tr>:filtered.map(r=>
              <tr key={r.id}>
                <td className="px-6 py-4 font-black text-primary">{r.so_number}</td>
                <td className="px-6 py-4 font-bold">{r.artikel}</td>
                <td className="px-6 py-4 text-center font-black">{Number(r.target_qty).toLocaleString()}</td>
                <td className="px-6 py-4 text-center font-black text-emerald-600">{Number(r.actual_qty).toLocaleString()}</td>
                <td className="px-6 py-4 text-center font-black text-rose-600">{Number(r.shortage).toLocaleString()}</td>
                <td className="px-6 py-4"><div className="h-2.5 bg-slate-100 rounded-full overflow-hidden"><div className={'h-full rounded-full '+(r.status==='COMPLETED'?'bg-emerald-500':'bg-primary')} style={{width:(r.percentage||0)+'%'}}/></div><p className="text-[9px] text-right text-textMuted font-bold mt-1">{r.percentage}%</p></td>
                <td className="px-6 py-4 text-center">{r.status==='COMPLETED'?<span className="badge-success"><CheckCircle size={12}/>Completed</span>:<span className="badge-warning"><Clock size={12}/>In Progress</span>}</td>
                <td className="px-6 py-4 text-right"><button onClick={()=>remove(r.id)} className="p-2 rounded-lg bg-red-50 text-red-600" title="Delete"><Trash2 size={14}/></button></td>
              </tr>
            )}
            {!loading&&!filtered.length&&<tr><td colSpan="8" className="py-14 text-center text-xs font-bold text-textMuted">No planning targets.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>

    {open&&<div className="fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={save} className="bg-surface rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between mb-5"><div><h3 className="font-black">SO Planning Input</h3><p className="text-[10px] text-textMuted font-semibold mt-1">Use Google Sheets to auto-fill planning data.</p></div><button type="button" onClick={()=>setOpen(false)}><X size={18}/></button></div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-5">
          <div className="flex items-center gap-2 text-primary mb-3"><CloudDownload size={16}/><span className="text-xs font-black uppercase tracking-wider">Auto Pull Data (Google Sheets)</span></div>
          <div className="flex gap-3">
            <input className="form-input flex-1 uppercase" placeholder="Type SO Number..." value={form.so_number} onChange={e=>setForm({...form,so_number:e.target.value.toUpperCase()})}/>
            <button type="button" onClick={pullFromSheets} disabled={pulling} className="btn-primary px-5">{pulling?'SYNCING...':'SYNC'}</button>
          </div>
          {pullStatus&&<div className="text-xs font-bold mt-3">{pullStatus}</div>}
        </div>

        <div className="space-y-4">
          <label className="form-label">SO Number<input required className="form-input mt-1 uppercase" value={form.so_number} onChange={e=>setForm({...form,so_number:e.target.value.toUpperCase()})}/></label>
          <label className="form-label">Article / Style<input required className="form-input mt-1 uppercase" value={form.artikel} onChange={e=>setForm({...form,artikel:e.target.value.toUpperCase()})}/></label>
          <label className="form-label">Target Qty<input required type="number" min="1" className="form-input mt-1" value={form.target_qty} onChange={e=>setForm({...form,target_qty:e.target.value})}/></label>
        </div>

        <button className="btn-primary w-full mt-6">{pulling?'Syncing...':'Save Planning Target'}</button>
      </form>
    </div>}
  </div>;
}