import { Router } from 'express';
import { ServerValue } from 'firebase-admin/database';
import { adminDb } from '../firebase.js';

const router = Router();

function isNestedSO(node) {
  return !!node && typeof node === 'object' && (
    Object.prototype.hasOwnProperty.call(node, 'informasi_master') ||
    Object.prototype.hasOwnProperty.call(node, 'karton')
  );
}

async function buildInboundMap() {
  const snapshot = await adminDb.ref('stok_inbound_wh').once('value');
  const value = snapshot.val() || {};
  const map = {};

  for (const [soKey, node] of Object.entries(value)) {
    const master = node?.informasi_master || {};
    if (isNestedSO(node)) {
      for (const item of Object.values(node.karton || {})) {
        const so = String(item?.so_number || master.so_number || soKey.replace(/^SO_/, '')).toUpperCase().trim();
        if (!so) continue;
        map[so] = (map[so] || 0) + (Number(item?.isi_karton || item?.qty || 0) || 0);
      }
    } else {
      const so = String(node?.so_number || soKey.replace(/^SO_/, '')).toUpperCase().trim();
      if (!so) continue;
      map[so] = (map[so] || 0) + (Number(node?.isi_karton || node?.qty || 0) || 0);
    }
  }
  return map;
}

router.get('/', async (_req, res, next) => {
  try {
    const [planningSnapshot, inboundMap] = await Promise.all([
      adminDb.ref('so_planning').once('value'),
      buildInboundMap()
    ]);
    const value = planningSnapshot.val() || {};
    const rows = Object.entries(value).map(([id, item]) => {
      const so = String(item?.so_number || '').toUpperCase().trim();
      const target = Number(item?.target_qty) || 0;
      const actual = inboundMap[so] || 0;
      return {
        id, ...(item || {}), so_number: so, target_qty: target, actual_qty: actual,
        shortage: Math.max(target - actual, 0),
        percentage: target ? Math.min(Math.round((actual / target) * 100), 100) : 0,
        status: target && actual >= target ? 'COMPLETED' : 'IN_PROGRESS'
      };
    });
    rows.sort((a,b)=>Number(b.created_at_ts||0)-Number(a.created_at_ts||0));
    res.json({ success:true, data:rows });
  } catch(error){ next(error); }
});

router.post('/', async (req,res,next)=>{
  try{
    const so=String(req.body.so_number||'').toUpperCase().trim();
    const artikel=String(req.body.artikel||'').toUpperCase().trim();
    const target=Number(req.body.target_qty)||0;
    if(!so||!artikel||target<=0)return res.status(400).json({success:false,message:'SO, article and target quantity are required.'});
    const ref=adminDb.ref('so_planning').push();
    const data={so_number:so,artikel,target_qty:target,created_at:new Date().toISOString().slice(0,10),created_by:req.user.email||req.user.uid,created_at_ts:ServerValue.TIMESTAMP};
    await ref.set(data);
    res.status(201).json({success:true,data:{id:ref.key,...data}});
  }catch(error){next(error);}
});

router.delete('/:id',async(req,res,next)=>{
  try{
    const ref=adminDb.ref('so_planning').child(req.params.id);
    if(!(await ref.once('value')).exists())return res.status(404).json({success:false,message:'Planning target not found.'});
    await ref.remove();
    res.json({success:true,id:req.params.id});
  }catch(error){next(error);}
});

export default router;
