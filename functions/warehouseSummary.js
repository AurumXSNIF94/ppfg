const GROUPS = {
  by_article: row => String(row.artikel || '-').trim().toUpperCase(),
  by_destination: row => String(row.destination || '-').trim().toUpperCase(),
  by_size: row => String(row.size || '-').trim().toUpperCase()
};

export function summaryKey(value) {
  const bytes = new TextEncoder().encode(String(value ?? ''));
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function summaryIncrement(delta) {
  return { '.sv': { increment: Number(delta) || 0 } };
}

function active(rows = []) {
  return (Array.isArray(rows) ? rows : []).filter(row => row && !row._emptySO);
}

function soName(row) {
  return String(row?.so_number || row?.so_key || '').toUpperCase().replace(/^SO_/, '').trim();
}

function aggregate(rows, keyFn) {
  const map = new Map();
  for (const row of active(rows)) {
    const name = keyFn(row);
    if (!name) continue;
    const current = map.get(name) || { name, qty: 0, karton: 0 };
    current.qty += Number(row.isi_karton) || 0;
    current.karton += 1;
    map.set(name, current);
  }
  return map;
}

function aggregateSO(rows) {
  const map = new Map();
  for (const row of active(rows)) {
    const so = soName(row);
    if (!so) continue;
    const current = map.get(so) || {
      so_number: so,
      artikel: String(row.artikel || '-').toUpperCase(),
      destination: String(row.destination || '-').toUpperCase(),
      qty: 0,
      karton: 0,
      last_update: 0,
      sizes: new Set()
    };
    if (current.artikel === '-' && row.artikel) current.artikel = String(row.artikel).toUpperCase();
    if (current.destination === '-' && row.destination) current.destination = String(row.destination).toUpperCase();
    current.qty += Number(row.isi_karton) || 0;
    current.karton += 1;
    if (row.size) current.sizes.add(String(row.size).toUpperCase());
    const stamp = Number(row.timestamp_in || 0) || new Date(row.lastUpdate || 0).getTime() || 0;
    current.last_update = Math.max(current.last_update, stamp);
    map.set(so, current);
  }
  return map;
}

export function buildWarehouseSummary(rows = []) {
  const cleanRows = active(rows);
  const bySO = aggregateSO(cleanRows);
  const byArticle = aggregate(cleanRows, GROUPS.by_article);
  const byDestination = aggregate(cleanRows, GROUPS.by_destination);
  const bySize = aggregate(cleanRows, GROUPS.by_size);

  const encodeMap = (map, includeName = true) => Object.fromEntries(
    [...map.entries()].map(([name, value]) => [
      summaryKey(name),
      includeName ? value : { qty: value.qty, karton: value.karton }
    ])
  );

  const totalQty = cleanRows.reduce((sum, row) => sum + (Number(row.isi_karton) || 0), 0);

  return {
    version: 1,
    meta: {
      totalSO: bySO.size,
      totalKarton: cleanRows.length,
      totalQty,
      updatedAt: Date.now()
    },
    by_so: Object.fromEntries([...bySO.entries()].map(([so, value]) => [summaryKey(so), {
      ...value,
      sizes: [...value.sizes].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))
    }])),
    by_article: encodeMap(byArticle),
    by_destination: encodeMap(byDestination),
    by_size: encodeMap(bySize)
  };
}

function diffMap(before, after) {
  const names = new Set([...before.keys(), ...after.keys()]);
  const result = [];
  for (const name of names) {
    const oldValue = before.get(name) || { qty: 0, karton: 0 };
    const newValue = after.get(name) || { qty: 0, karton: 0 };
    result.push({
      name,
      deltaQty: newValue.qty - oldValue.qty,
      deltaKarton: newValue.karton - oldValue.karton,
      after: newValue
    });
  }
  return result;
}

function diffSO(before, after) {
  const names = new Set([...before.keys(), ...after.keys()]);
  return [...names].map(so => {
    const oldValue = before.get(so) || { qty: 0, karton: 0 };
    const newValue = after.get(so) || { qty: 0, karton: 0 };
    return {
      so,
      deltaQty: newValue.qty - oldValue.qty,
      deltaKarton: newValue.karton - oldValue.karton,
      before: oldValue,
      after: newValue
    };
  });
}

export async function syncWarehouseSummary(firebaseRequest, env, request, beforeRows = [], afterRows = []) {
  const before = active(beforeRows);
  const after = active(afterRows);
  const beforeSO = aggregateSO(before);
  const afterSO = aggregateSO(after);

  const currentSummary = await getWarehouseSummary(firebaseRequest, env, request);
  const updates = {};
  const setIncrement = (path, delta) => {
    if (delta) updates[path] = summaryIncrement(delta);
  };

  setIncrement('warehouse_summary/meta/totalKarton', after.length - before.length);
  setIncrement(
    'warehouse_summary/meta/totalQty',
    after.reduce((sum, row) => sum + (Number(row.isi_karton) || 0), 0) -
      before.reduce((sum, row) => sum + (Number(row.isi_karton) || 0), 0)
  );
  setIncrement('warehouse_summary/meta/totalSO', afterSO.size - beforeSO.size);

  for (const item of diffSO(beforeSO, afterSO)) {
    const key = summaryKey(item.so);
    if (!item.after.karton) {
      updates[`warehouse_summary/by_so/${key}`] = null;
      continue;
    }
    const existingSO = currentSummary?.by_so?.[key];
    if (existingSO) {
      setIncrement(`warehouse_summary/by_so/${key}/qty`, item.deltaQty);
      setIncrement(`warehouse_summary/by_so/${key}/karton`, item.deltaKarton);
    } else {
      updates[`warehouse_summary/by_so/${key}/qty`] = item.after.qty;
      updates[`warehouse_summary/by_so/${key}/karton`] = item.after.karton;
    }
    updates[`warehouse_summary/by_so/${key}/so_number`] = item.after.so_number;
    updates[`warehouse_summary/by_so/${key}/artikel`] = item.after.artikel;
    updates[`warehouse_summary/by_so/${key}/destination`] = item.after.destination;
    updates[`warehouse_summary/by_so/${key}/last_update`] = item.after.last_update || Date.now();
    updates[`warehouse_summary/by_so/${key}/sizes`] = [...(item.after.sizes || [])].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  }

  const dimensions = [
    ['by_article', GROUPS.by_article],
    ['by_destination', GROUPS.by_destination],
    ['by_size', GROUPS.by_size]
  ];

  for (const [groupName, keyFn] of dimensions) {
    const beforeMap = aggregate(before, keyFn);
    const afterMap = aggregate(after, keyFn);
    for (const item of diffMap(beforeMap, afterMap)) {
      const key = summaryKey(item.name);
      if (!item.after.karton) {
        updates[`warehouse_summary/${groupName}/${key}`] = null;
        continue;
      }
      const existingDimension = currentSummary?.[groupName]?.[key];
      if (existingDimension) {
        setIncrement(`warehouse_summary/${groupName}/${key}/qty`, item.deltaQty);
        setIncrement(`warehouse_summary/${groupName}/${key}/karton`, item.deltaKarton);
      } else {
        updates[`warehouse_summary/${groupName}/${key}/qty`] = item.after.qty;
        updates[`warehouse_summary/${groupName}/${key}/karton`] = item.after.karton;
      }
      updates[`warehouse_summary/${groupName}/${key}/name`] = item.name;
    }
  }

  updates['warehouse_summary/meta/updatedAt'] = Date.now();

  if (Object.keys(updates).length) {
    await firebaseRequest(env, request, '', {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }
}

export async function rebuildWarehouseSummary(firebaseRequest, env, request, rows = null) {
  const sourceRows = rows || [];
  const summary = buildWarehouseSummary(sourceRows);
  await firebaseRequest(env, request, 'warehouse_summary', {
    method: 'PUT',
    body: JSON.stringify(summary)
  });
  return summary;
}

export async function getWarehouseSummary(firebaseRequest, env, request) {
  const value = await firebaseRequest(env, request, 'warehouse_summary');
  return value && typeof value === 'object' ? value : null;
}
