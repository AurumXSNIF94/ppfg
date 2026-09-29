import { useState } from 'react';
import { api } from '../services/api';

export default function EntryForm() {
  const [loading,setLoading]=useState(false);
  const [syncStatus,setSyncStatus]=useState('');
  const [tarikSo,setTarikSo]=useState('');
  const [tanggal,setTanggal]=useState(new Date().toISOString().split('T')[0]);
  const [soNumber,setSoNumber]=useState('');
  const [jenis,setJenis]=useState('SOLID');
  const [artikel,setArtikel]=useState('');
  const [destination,setDestination]=useState('');
  const [keterangan,setKeterangan]=useState('');
  const [cartons,setCartons]=useState([{id:Date.now(),size:'',noKarton:'',qty:''}]);

  const handleSyncSheets=async()=>{
    if(!tarikSo)return setSyncStatus('❌ Masukkan SO terlebih dahulu.');
    setSyncStatus('⏳ Syncing...');
    try{
      const r=await api.gas({so:tarikSo});
      const arr=Array.isArray(r)?r:(r.data||[]);
      const m=arr.find(x=>(x.so||x.SO||'').toString().toUpperCase().trim()===tarikSo)||arr[0];
      if(m){
        setSoNumber((m.so||m.SO||tarikSo).toUpperCase());
        setArtikel((m.artikel||m.Article||'').toUpperCase());
        setDestination((m.destination||m.Destination||m.destinasi||'').toUpperCase());
      }
      setSyncStatus('✅ SO data successfully pulled.');
    }catch(e){setSyncStatus('❌ '+e.message)}
  };

  const addRow=()=>setCartons([...cartons,{id:Date.now(),size:jenis==='MIX'?'-':'',noKarton:'',qty:''}]);
  const update=(id,field,value)=>setCartons(cartons.map(c=>c.id===id?{...c,[field]:value}:c));

  const save=async()=>{
    if(!soNumber||!artikel||!destination)return alert('SO, Article, and Destination are required.');
    const valid=cartons.filter(c=>c.size&&c.noKarton&&c.qty);
    if(!valid.length)return alert('Isi minimal 1 detail karton.');
    setLoading(true);
    try{
      await api.inbound.create({
        tanggal,
        so_number:soNumber,
        jenis,
        artikel,
        destination,
        keterangan,
        cartons:valid.map(c=>({
          size:c.size,
          no_karton:c.noKarton.startsWith('#')?c.noKarton:'#'+c.noKarton,
          isi_karton:Number(c.qty)||0
        }))
      });
      alert('✅ Data successfully saved.');
      setSoNumber('');
      setArtikel('');
      setDestination('');
      setKeterangan('');
      setTarikSo('');
      setSyncStatus('');
      setCartons([{id:Date.now(),size:jenis==='MIX'?'-':'',noKarton:'',qty:''}]);
    }catch(e){alert('API Error: '+e.message)}
    finally{setLoading(false)}
  };

  return <div className="max-w-5xl mx-auto">
    <div className="bg-surface p-6 rounded-2xl shadow-sm border-l-4 border-primary mb-6">
      <h3 className="text-primary font-extrabold mb-1">⚡ Auto Pull Data (Google Sheets)</h3>
      <p className="text-xs text-textMuted font-bold mb-4">Request sekarang melewati backend API.</p>
      <div className="flex gap-4">
        <input className="form-input flex-1 uppercase" placeholder="Type SO Number..." value={tarikSo} onChange={e=>setTarikSo(e.target.value.toUpperCase())}/>
        <button onClick={handleSyncSheets} className="btn-primary w-32">SYNC</button>
      </div>
      {syncStatus&&<div className="text-xs font-bold mt-3 text-primary">{syncStatus}</div>}
    </div>

    <div className="bg-surface p-8 rounded-2xl shadow-sm border border-borderLight">
      <h2 className="text-lg font-extrabold text-textMain mb-6">📥 Manual Inbound Form</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
        <Field label="Date"><input type="date" className="form-input" value={tanggal} onChange={e=>setTanggal(e.target.value)}/></Field>
        <Field label="SO Number"><input className="form-input uppercase" value={soNumber} onChange={e=>setSoNumber(e.target.value.toUpperCase())}/></Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
        <Field label="Carton Type">
          <select className="form-input" value={jenis} onChange={e=>{setJenis(e.target.value);setCartons(cartons.map(c=>({...c,size:e.target.value==='MIX'?'-':''})))}}>
            <option>SOLID</option><option>MIX</option>
          </select>
        </Field>
        <Field label="Article / Style"><input className="form-input uppercase" value={artikel} onChange={e=>setArtikel(e.target.value.toUpperCase())}/></Field>
      </div>

      <Field label="Destination"><input className="form-input uppercase mb-6" value={destination} onChange={e=>setDestination(e.target.value.toUpperCase())}/></Field>
      <Field label="Additional Notes"><input className="form-input mb-8" value={keterangan} onChange={e=>setKeterangan(e.target.value)}/></Field>

      <div className="bg-bgBody border border-dashed border-slate-300 p-6 rounded-xl mb-6">
        <h3 className="text-xs font-extrabold text-textMuted uppercase mb-4">Carton Details</h3>
        {cartons.map(c=><div key={c.id} className="flex gap-4 mb-3">
          <input className={`form-input flex-1 uppercase ${jenis==='MIX'?'bg-slate-200':''}`} placeholder="Size" value={c.size} readOnly={jenis==='MIX'} onChange={e=>update(c.id,'size',e.target.value.toUpperCase())}/>
          <input className="form-input flex-1 uppercase" placeholder="Ctn No." value={c.noKarton} onChange={e=>update(c.id,'noKarton',e.target.value.toUpperCase())}/>
          <input type="number" className="form-input flex-1" placeholder="Qty Pcs" value={c.qty} onChange={e=>update(c.id,'qty',e.target.value)}/>
          {cartons.length>1&&<button onClick={()=>setCartons(cartons.filter(x=>x.id!==c.id))} className="bg-red-100 text-red-600 px-4 rounded-lg font-bold">✕</button>}
        </div>)}
        <button onClick={addRow} className="w-full mt-2 py-3 bg-white border border-dashed border-primary text-primary font-bold rounded-lg">+ Add New Row</button>
      </div>

      <button onClick={save} disabled={loading} className="w-full btn-primary text-base py-4">{loading?'Saving...':'Save Data & Sync'}</button>
    </div>
  </div>
}
function Field({label,children}){return <div><label className="form-label">{label}</label>{children}</div>}
