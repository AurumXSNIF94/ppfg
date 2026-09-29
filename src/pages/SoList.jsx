import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, RefreshCw, Search, X, Package, CalendarDays, Globe2, ClipboardList } from 'lucide-react';
import { api } from '../services/api';

function formatNumber(value){return Number(value||0).toLocaleString('id-ID');}
function formatDate(value){
  if(!value)return '-';
  const d=new Date(value);
  return Number.isNaN(d.getTime())?String(value):d.toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'});
}

export default function SoList(){
  const [rows,setRows]=useState([]);
  const [term,setTerm]=useState('');
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState(null);
  const [detailLoading,setDetailLoading]=useState(false);
  const [detailError,setDetailError]=useState('');

  const load=async()=>{
    try{setLoading(true);const r=await api.so.list();setRows(r.data||[]);}
    catch(e){alert(e.message);}
    finally{setLoading(false);}
  };

  useEffect(()=>{load();},[]);

  const filtered=useMemo(()=>{
    const q=term.toUpperCase().trim();
    return rows.filter(r=>!q||[r.so_number,r.artikel,r.destination].some(v=>String(v||'').toUpperCase().includes(q)));
  },[rows,term]);

  const openDetail=async(so)=>{
    try{
      setDetailLoading(true);
      setDetailError('');
      setSelected(null);
      const r=await api.so.detail(so);
      setSelected(r.data||null);
    }catch(e){setDetailError(e.message);}
    finally{setDetailLoading(false);}
  };

  return <div className="max-w-7xl mx-auto space-y-5">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div><h2 className="text-xl font-black">SO Master List</h2><p className="text-xs font-semibold text-textMuted mt-1">Aggregated directly by the backend from active inbound cartons.</p></div>
      <div className="flex gap-2">
        <div className="relative w-full md:w-80"><Search size={15} className="absolute left-3.5 top-3 text-textMuted"/><input className="form-input pl-10 uppercase" placeholder="Search SO, Article, Destination..." value={term} onChange={e=>setTerm(e.target.value)}/></div>
        <button onClick={load} className="px-3 rounded-xl border border-borderLight bg-surface text-textMuted hover:text-primary"><RefreshCw size={16} className={loading?'animate-spin':''}/></button>
      </div>
    </div>

    <div className="bg-surface border border-borderLight rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead><tr className="bg-bgBody border-b border-borderLight text-[10px] uppercase tracking-wider text-textMuted">
            <th className="px-6 py-4 text-left">SO Number</th><th className="px-6 py-4 text-left">Article</th><th className="px-6 py-4 text-left">Destination</th><th className="px-6 py-4 text-center">Cartons</th><th className="px-6 py-4 text-center">Qty</th><th className="px-6 py-4 text-left">Sizes</th>
          </tr></thead>
          <tbody className="divide-y divide-borderLight">
            {loading?<tr><td colSpan="6" className="py-14 text-center text-xs font-bold text-textMuted">Loading SO master...</td></tr>:filtered.map(r=><tr key={r.so_number} className="hover:bg-indigo-50/30">
              <td className="px-6 py-4 font-black text-primary">
                <button type="button" onClick={()=>openDetail(r.so_number)} className="inline-flex items-center hover:underline focus:outline-none focus:ring-2 focus:ring-primary/30 rounded-md" title="View SO detail"><FileSpreadsheet size={15} className="mr-2"/>{r.so_number}</button>
              </td>
              <td className="px-6 py-4 font-bold">{r.artikel}</td>
              <td className="px-6 py-4 text-xs font-semibold">{r.destination}</td>
              <td className="px-6 py-4 text-center font-black">{formatNumber(r.total_cartons)}</td>
              <td className="px-6 py-4 text-center font-black">{formatNumber(r.total_pcs)}</td>
              <td className="px-6 py-4 text-xs font-bold text-textMuted">{r.sizes?.join(', ')||'-'}</td>
            </tr>)}
            {!loading&&!filtered.length&&<tr><td colSpan="6" className="py-14 text-center text-xs font-bold text-textMuted">No SO records found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>

    {(detailLoading||detailError||selected)&&<div className="fixed inset-0 z-[110] bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={e=>{if(e.target===e.currentTarget){setSelected(null);setDetailError('')}}}>
      <div className="bg-surface rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl border border-borderLight">
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-borderLight">
          <div><p className="text-[9px] uppercase tracking-[0.18em] font-black text-primary">SO DETAIL</p><h3 className="text-xl font-black mt-1">{selected?.so_number||'Loading...'}</h3><p className="text-xs text-textMuted font-semibold mt-1">Master information and carton details</p></div>
          <button onClick={()=>{setSelected(null);setDetailError('')}} className="p-2 rounded-lg hover:bg-bgBody text-textMuted"><X size={18}/></button>
        </div>

        {detailLoading&&<div className="py-16 text-center text-sm font-bold text-textMuted">Loading SO detail...</div>}
        {!detailLoading&&detailError&&<div className="m-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{detailError}</div>}
        {!detailLoading&&selected&&<div className="overflow-y-auto max-h-[calc(90vh-82px)] p-6 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Info label="SO Number" value={selected.so_number}/>
            <Info label="Article" value={selected.master?.artikel}/>
            <Info label="Destination" value={selected.master?.destination}/>
            <Info label="Carton Type" value={selected.master?.jenis}/>
            <Info label="Date" value={selected.master?.tanggal}/>
            <Info label="Status" value={selected.master?.status}/>
            <Info label="Last Update" value={formatDate(selected.master?.terakhir_update||selected.master?.timestamp_in)}/>
            <Info label="Total Cartons" value={formatNumber(selected.summary?.total_cartons)}/>
            <Info label="Total Qty" value={`${formatNumber(selected.summary?.total_pcs)} pcs`}/>
            <Info label="Sizes" value={selected.summary?.sizes?.join(', ')||'-'}/>
          </div>

          {selected.master?.keterangan&&<div className="rounded-xl border border-borderLight bg-bgBody p-4"><div className="text-[10px] uppercase font-black text-textMuted mb-1">Additional Notes</div><div className="text-sm font-semibold">{selected.master.keterangan}</div></div>}

          <div className="bg-surface border border-borderLight rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-borderLight flex items-center gap-2"><ClipboardList size={16} className="text-primary"/><span className="font-black text-sm">Carton Details</span><span className="ml-auto text-xs font-bold text-textMuted">{formatNumber(selected.cartons?.length)} cartons</span></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left">
                <thead><tr className="bg-bgBody text-[10px] uppercase tracking-wider text-textMuted"><th className="px-4 py-3">#</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Size</th><th className="px-4 py-3">Carton</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3">Status</th></tr></thead>
                <tbody className="divide-y divide-borderLight">
                  {(selected.cartons||[]).map((c,i)=><tr key={c.id||i}><td className="px-4 py-3 text-xs font-bold text-textMuted">{i+1}</td><td className="px-4 py-3 text-xs">{c.tanggal||'-'}</td><td className="px-4 py-3 text-xs font-bold">{c.size||'-'}</td><td className="px-4 py-3 text-xs font-black">{c.nomor_karton||'-'}</td><td className="px-4 py-3 text-xs font-black text-right">{formatNumber(c.isi_karton)}</td><td className="px-4 py-3 text-xs font-bold">{c.status||'-'}</td></tr>)}
                  {!selected.cartons?.length&&<tr><td colSpan="6" className="py-10 text-center text-xs font-bold text-textMuted">No carton details found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>}
      </div>
    </div>}
  </div>;
}

function Info({label,value}){
  return <div className="rounded-xl border border-borderLight bg-bgBody p-3"><div className="text-[9px] uppercase tracking-wider font-black text-textMuted">{label}</div><div className="text-sm font-black mt-1 break-words">{value??'-'}</div></div>;
}
