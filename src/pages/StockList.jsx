import { useEffect,useMemo,useState } from 'react';
import { Search,Globe,Trash2,Edit3,X,FileText } from 'lucide-react';
import { api } from '../services/api';

export default function StockList(){
 const [rawData,setRawData]=useState([]),[searchTerm,setSearchTerm]=useState(''),[loading,setLoading]=useState(true),[editingItem,setEditingItem]=useState(null),[form,setForm]=useState({});
 const load=async()=>{try{setLoading(true);const r=await api.inbound.list();setRawData(r.data||[])}catch(e){alert(e.message)}finally{setLoading(false)}};
 useEffect(()=>{load()},[]);
 const filtered=useMemo(()=>{const t=searchTerm.toUpperCase().trim();return rawData.filter(d=>!t||[d.so_number,d.artikel,d.destination,d.nomor_karton,d.size].some(v=>String(v||'').toUpperCase().includes(t)))},[rawData,searchTerm]);
 const open=(item)=>{setEditingItem(item);setForm({...item})};
 const save=async()=>{try{await api.inbound.update(editingItem.id,{tanggal:form.tanggal,so_number:form.so_number,jenis:form.jenis,artikel:form.artikel,size:form.size,nomor_karton:form.nomor_karton,isi_karton:form.isi_karton,destination:form.destination});setEditingItem(null);await load()}catch(e){alert(e.message)}};
 const remove=async(id)=>{if(!confirm('Delete this carton record?'))return;try{await api.inbound.remove(id);await load()}catch(e){alert(e.message)}};
 return <div className="max-w-7xl mx-auto flex flex-col h-full relative">
  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
   <div><h2 className="text-xl font-extrabold">Stock Inbound Records</h2><p className="text-xs font-semibold text-textMuted mt-0.5">CRUD operations are processed by the backend API.</p></div>
   <div className="relative w-full md:w-80"><Search className="absolute left-3.5 top-3 h-4 w-4 text-textMuted"/><input className="w-full pl-10 pr-4 py-2.5 border border-borderLight rounded-xl text-xs font-bold bg-surface uppercase" placeholder="Search SO, Article, Carton No., Size..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/></div>
  </div>

  <div className="flex-1 bg-surface border border-borderLight rounded-2xl shadow-sm overflow-hidden flex flex-col">
   <div className="overflow-auto flex-1">
    <table className="w-full min-w-[900px] text-left">
     <thead><tr className="bg-bgBody border-b border-borderLight text-[11px] font-extrabold text-textMuted uppercase">
      <th className="py-4 px-6">Date</th><th className="py-4 px-6">SO</th><th className="py-4 px-6">Type</th><th className="py-4 px-6">Article</th><th className="py-4 px-6">Size</th><th className="py-4 px-6">Carton No.</th><th className="py-4 px-6">Qty Pcs</th><th className="py-4 px-6">Destination</th><th className="py-4 px-6 text-right">Actions</th>
     </tr></thead>
     <tbody className="divide-y divide-borderLight text-xs font-semibold">
      {loading?<tr><td colSpan="9" className="text-center py-12">Loading...</td></tr>:filtered.map(d=><tr key={d.id} className="hover:bg-indigo-50/40">
       <td className="py-4 px-6">{d.tanggal||'-'}</td><td className="py-4 px-6 font-extrabold text-primary"><FileText size={14} className="inline mr-2"/>{d.so_number}</td><td className="py-4 px-6">{d.jenis}</td><td className="py-4 px-6 font-bold">{d.artikel}</td><td className="py-4 px-6">{d.size}</td><td className="py-4 px-6">{d.nomor_karton}</td><td className="py-4 px-6 font-black">{Number(d.isi_karton||0).toLocaleString()}</td><td className="py-4 px-6"><Globe size={12} className="inline mr-1 text-primary"/>{d.destination}</td>
       <td className="py-4 px-6 text-right"><button onClick={()=>open(d)} className="p-2 text-primary"><Edit3 size={15}/></button><button onClick={()=>remove(d.id)} className="p-2 text-red-500"><Trash2 size={15}/></button></td>
      </tr>)}{!loading&&!filtered.length&&<tr><td colSpan="9" className="text-center py-12 text-textMuted font-bold">No records found.</td></tr>}
     </tbody>
    </table>
   </div>
  </div>

  {editingItem&&<div className="fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
   <div className="bg-surface rounded-2xl w-full max-w-2xl p-6 shadow-2xl">
    <div className="flex justify-between items-center mb-5"><h3 className="font-black">Edit Carton</h3><button onClick={()=>setEditingItem(null)}><X/></button></div>
    <div className="grid grid-cols-2 gap-4">{['tanggal','so_number','jenis','artikel','size','nomor_karton','isi_karton','destination'].map(k=><label key={k} className="text-xs font-bold text-textMuted">{k}<input className="form-input mt-1" value={form[k]??''} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}</div>
    <button onClick={save} className="btn-primary w-full mt-6">Save Changes</button>
   </div>
  </div>}
 </div>
}
