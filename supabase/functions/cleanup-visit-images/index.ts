import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
const BUCKET = 'visitas-images';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function storagePath(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    let path = value.trim();
    if (/^https?:\/\//i.test(path)) {
        try {
            const url = new URL(path);
            if (url.origin !== new URL(Deno.env.get('SUPABASE_URL')).origin) return null;
            const marker = `/${BUCKET}/`;
            const index = url.pathname.indexOf(marker);
            if (index < 0) return null;
            path = url.pathname.slice(index + marker.length);
        } catch (_) { return null; }
    } else if (path.startsWith(`${BUCKET}/`)) path = path.slice(BUCKET.length + 1);
    try { path = decodeURIComponent(path); } catch (_) {}
    return path;
}
function collectReferences(value, refs) {
    if (typeof value === 'string') {
        const path = storagePath(value);
        if (path) refs.add(path);
        try { const parsed = JSON.parse(value); if (parsed && typeof parsed === 'object') collectReferences(parsed, refs); } catch (_) {}
    } else if (Array.isArray(value)) {
        value.forEach(item => collectReferences(item, refs));
    } else if (value && typeof value === 'object') {
        Object.values(value).forEach(item => collectReferences(item, refs));
    }
}
async function readReferences(client) {
    const refs = new Set();
    for (const [table, fields] of [['visitas', 'id,respostas,observacao'], ['profiles', 'id,avatar_url']]) {
        for (let offset = 0; ; offset += 500) {
            const {data, error} = await client.from(table).select(fields).order('id').range(offset, offset + 499);
            if (error) throw error;
            for (const row of (data || [])) collectReferences(row, refs);
            if (!data || data.length < 500) break;
        }
    }
    return refs;
}
async function listObjects(client) {
    const objects = [], folders = [''];
    for (let i = 0; i < folders.length; i++) {
        const prefix = folders[i];
        for (let offset = 0; ; offset += 100) {
            const {data, error} = await client.storage.from(BUCKET).list(prefix, {limit: 100, offset, sortBy: {column: 'name', order: 'asc'}});
            if (error) throw error;
            for (const item of (data || [])) {
                const name = prefix ? `${prefix}/${item.name}` : item.name;
                if (!item.id && !item.metadata) folders.push(name);
                else objects.push({...item, name});
            }
            if (!data || data.length < 100) break;
        }
    }
    return objects;
}
Deno.serve(async req => {
    const respond = (value, status = 200) => new Response(JSON.stringify(value), {status, headers: {...cors, 'Content-Type': 'application/json'}});
    if (req.method === 'OPTIONS') return new Response('ok', {headers: cors});
    if (req.method !== 'POST') return respond({error: 'POST required'}, 405);
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!serviceKey || bearer !== serviceKey) return respond({error: 'Unauthorized'}, 401);
    try {
        const payload = await req.json().catch(() => ({}));
        const days = payload.days === undefined ? 30 : payload.days;
        if (!Number.isInteger(days) || days < 7) return respond({error: 'days must be an integer >= 7'}, 400);
        const grace = Date.now() - days * 86400000;
        const requestedCutoff = payload.before ? Date.parse(payload.before) : grace;
        if (!Number.isFinite(requestedCutoff)) return respond({error: 'Invalid cutoff'}, 400);
        const cutoff = Math.min(grace, requestedCutoff);
        const dryRun = payload.dry_run !== false;
        const client = createClient(Deno.env.get('SUPABASE_URL'), serviceKey, {auth: {persistSession: false}});
        const references = await readReferences(client);
        const objects = await listObjects(client);
        const candidates = objects.filter(object => Date.parse(object.created_at) < cutoff && !references.has(object.name));
        let deleted = 0, freedBytes = 0, protectedCount = 0;
        const failures = [];
        if (!dryRun) {
            for (let offset = 0; offset < candidates.length; offset += 100) {
                // Recheck references before each deletion batch. Never modify visit answers.
                const currentReferences = await readReferences(client);
                const batch = candidates.slice(offset, offset + 100).filter(object => !currentReferences.has(object.name));
                protectedCount += Math.min(100, candidates.length - offset) - batch.length;
                if (!batch.length) continue;
                const {data, error} = await client.storage.from(BUCKET).remove(batch.map(object => object.name));
                if (error) { failures.push({batch: offset, message: error.message}); continue; }
                const removed = new Set((data || []).map(object => object.name));
                for (const object of batch) {
                    if (removed.has(object.name)) { deleted++; freedBytes += Number(object.metadata?.size || 0); }
                    else failures.push({path: object.name, message: 'Storage did not confirm deletion'});
                }
            }
        }
        return respond({dryRun, cutoff: new Date(cutoff).toISOString(), scanned: objects.length, candidates: candidates.length,
            candidateBytes: candidates.reduce((sum, object) => sum + Number(object.metadata?.size || 0), 0), deleted, freedBytes, protectedCount, failures});
    } catch (error) { console.error('Storage cleanup failed', error); return respond({error: error.message || 'Cleanup failed'}, 500); }
});
