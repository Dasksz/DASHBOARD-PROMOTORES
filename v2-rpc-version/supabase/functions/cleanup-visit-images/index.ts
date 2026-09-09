import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const payload = await req.json()
        const record = payload.record
        const client_code = record?.client_code

        if (!client_code) {
            return new Response(
                JSON.stringify({ error: 'Missing client_code in record payload.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Find ALL visits for this specific client, ordered from newest to oldest
        const { data: visits, error: fetchError } = await supabase
            .from('visitas')
            .select('id, client_code, data_visita, respostas')
            .eq('client_code', client_code)
            .not('respostas', 'is', null)
            .order('data_visita', { ascending: false })

        if (fetchError) {
            console.error('Error fetching visits:', fetchError)
            throw fetchError
        }

        if (!visits || visits.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No visits found for this client.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        // Filter exactly visits that HAVE photos in respostas->fotos array OR keys with 'foto'
        const visitsWithPhotos = visits.filter(visit => {
            const respostas = visit.respostas
            if (!respostas || typeof respostas !== 'object') return false;

            // Check for modern array format
            if (respostas.fotos && Array.isArray(respostas.fotos) && respostas.fotos.length > 0) {
                return true
            }

            // Check for legacy flat format (e.g. foto_antes_1, foto_depois)
            for (const [key, value] of Object.entries(respostas)) {
                if (key.toLowerCase().includes('foto') && value && !Array.isArray(value)) {
                    return true;
                }
            }

            return false
        })

        if (visitsWithPhotos.length <= 2) {
            return new Response(
                JSON.stringify({ message: 'Client has 2 or fewer visits with photos. No cleanup needed.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        // Identify older visits to clean up (all except the newest 2)
        const visitsToCleanup = visitsWithPhotos.slice(2)
        let totalFilesDeleted = 0
        const filesFailedToDelete = []
        const visitsUpdated = []

        console.log(`[CLEANUP] Found ${visitsToCleanup.length} old visits to cleanup for client ${client_code}.`)

        const cleanupPromises = visitsToCleanup.map(async (oldVisit) => {
            const respostas = oldVisit.respostas
            const filesToDeleteFromStorage = []

            // Extract modern array URLs
            if (respostas.fotos && Array.isArray(respostas.fotos)) {
                for (const foto of respostas.fotos) {
                    if (foto.url && typeof foto.url === 'string') {
                         filesToDeleteFromStorage.push(foto.url)
                    }
                }
            }

            // Extract legacy flat URLs
            for (const [key, value] of Object.entries(respostas)) {
                if (key.toLowerCase().includes('foto') && value && typeof value === 'string') {
                    filesToDeleteFromStorage.push(value)
                }
            }

            // Parse URLs to get Storage file paths
            const finalStoragePaths = []
            for (const rawUrl of filesToDeleteFromStorage) {
                 try {
                     if (rawUrl.startsWith('http')) {
                         const urlObj = new URL(rawUrl)
                         const parts = urlObj.pathname.split('/visitas-images/')
                         if (parts.length > 1) {
                             finalStoragePaths.push(parts[1]) // File path inside bucket
                         } else {
                             // Fallback if not matching standard format
                             finalStoragePaths.push(rawUrl)
                         }
                     } else {
                         // It might be stored just as filename string
                         finalStoragePaths.push(rawUrl)
                     }
                 } catch (e) {
                     finalStoragePaths.push(rawUrl)
                 }
            }

            let filesDeletedCount = 0
            let deleteErrorResult = null

            // A. Delete from Storage bucket
            if (finalStoragePaths.length > 0) {
                const { error: deleteError } = await supabase
                    .storage
                    .from('visitas-images')
                    .remove(finalStoragePaths)

                if (deleteError) {
                    console.error(`[CLEANUP] Failed to delete storage files for visit ${oldVisit.id}:`, deleteError)
                    deleteErrorResult = deleteError
                } else {
                    filesDeletedCount = finalStoragePaths.length
                    console.log(`[CLEANUP] Deleted ${finalStoragePaths.length} files for visit ${oldVisit.id}.`)
                }
            }

            // B. Update visit record: remove 'fotos' and all keys containing 'foto'
            const updatedRespostas = { ...oldVisit.respostas }
            delete updatedRespostas.fotos // remove modern array

            // remove legacy flat keys
            for (const key of Object.keys(updatedRespostas)) {
                if (key.toLowerCase().includes('foto')) {
                    delete updatedRespostas[key]
                }
            }

            const { error: updateError } = await supabase
                .from('visitas')
                .update({ respostas: updatedRespostas })
                .eq('id', oldVisit.id)

            let visitUpdatedId = null
            if (updateError) {
                console.error(`[CLEANUP] Failed to update DB record for visit ${oldVisit.id}:`, updateError)
            } else {
                visitUpdatedId = oldVisit.id
                console.log(`[CLEANUP] Updated JSON for visit ${oldVisit.id}.`)
            }

            return {
                visitId: oldVisit.id,
                filesDeletedCount,
                deleteError: deleteErrorResult,
                visitUpdatedId
            }
        })

        const results = await Promise.all(cleanupPromises)

        for (const res of results) {
            totalFilesDeleted += res.filesDeletedCount
            if (res.deleteError) {
                filesFailedToDelete.push({ visitId: res.visitId, error: res.deleteError })
            }
            if (res.visitUpdatedId) {
                visitsUpdated.push(res.visitUpdatedId)
            }
        }

        return new Response(
            JSON.stringify({
                message: 'Cleanup successful',
                client_code,
                totalOldVisitsProcessed: visitsToCleanup.length,
                totalFilesDeleted,
                visitsUpdated,
                filesFailedToDelete
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    } catch (error) {
        console.error('[CLEANUP] Critical Error:', error)
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
