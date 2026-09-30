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
        let payload: any = {}
        try {
            payload = await req.json()
        } catch (_) {
            // Allow empty body (e.g. GET or simple POST from cron)
        }

        const record = payload?.record
        const client_code = payload?.client_code || record?.client_code
        // Default retention period is 30 days
        const daysThreshold = typeof payload?.days === 'number' ? payload.days : 30

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Calculate cutoff date (e.g. 30 days ago)
        const cutoffDate = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000).toISOString()

        console.log(`[CLEANUP] Running cleanup for visits older than ${daysThreshold} days (Cutoff: ${cutoffDate})`)

        // Build query
        let query = supabase
            .from('visitas')
            .select('id, client_code, data_visita, created_at, respostas')
            .not('respostas', 'is', null)

        if (client_code) {
            query = query.eq('client_code', client_code)
        }

        // Fetch visits older than threshold (comparing against data_visita or created_at)
        // We use or condition or filter directly
        query = query.or(`data_visita.lt.${cutoffDate},and(data_visita.is.null,created_at.lt.${cutoffDate})`)

        const { data: visits, error: fetchError } = await query

        if (fetchError) {
            console.error('[CLEANUP] Error fetching visits:', fetchError)
            throw fetchError
        }

        if (!visits || visits.length === 0) {
            return new Response(
                JSON.stringify({ message: `No visits older than ${daysThreshold} days found.`, totalCleaned: 0 }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        // Filter visits that actually HAVE photos
        const visitsWithPhotos = visits.filter(visit => {
            const respostas = visit.respostas
            if (!respostas || typeof respostas !== 'object') return false;

            // Check modern array format
            if (respostas.fotos && Array.isArray(respostas.fotos) && respostas.fotos.length > 0) {
                return true
            }

            // Check legacy flat format
            for (const [key, value] of Object.entries(respostas)) {
                if (key.toLowerCase().includes('foto') && value && !Array.isArray(value)) {
                    return true;
                }
            }

            return false
        })

        if (visitsWithPhotos.length === 0) {
            return new Response(
                JSON.stringify({ message: `No visits older than ${daysThreshold} days with photos found.`, totalCleaned: 0 }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        console.log(`[CLEANUP] Found ${visitsWithPhotos.length} visits with photos older than ${daysThreshold} days to clean.`)

        let totalFilesDeleted = 0
        const filesFailedToDelete: any[] = []
        const visitsUpdated: any[] = []

        // Batch process visits
        const cleanupPromises = visitsWithPhotos.map(async (oldVisit) => {
            const respostas = oldVisit.respostas
            const filesToDeleteFromStorage: string[] = []

            // Extract modern array URLs
            if (respostas.fotos && Array.isArray(respostas.fotos)) {
                for (const foto of respostas.fotos) {
                    if (foto && typeof foto === 'object' && foto.url && typeof foto.url === 'string') {
                        filesToDeleteFromStorage.push(foto.url)
                    } else if (typeof foto === 'string') {
                        filesToDeleteFromStorage.push(foto)
                    }
                }
            }

            // Extract legacy flat URLs
            for (const [key, value] of Object.entries(respostas)) {
                if (key.toLowerCase().includes('foto') && value && typeof value === 'string') {
                    filesToDeleteFromStorage.push(value)
                }
            }

            // Parse URLs to extract storage file paths in 'visitas-images' bucket
            const finalStoragePaths: string[] = []
            for (const rawUrl of filesToDeleteFromStorage) {
                try {
                    if (rawUrl.startsWith('http')) {
                        const urlObj = new URL(rawUrl)
                        const parts = urlObj.pathname.split('/visitas-images/')
                        if (parts.length > 1) {
                            finalStoragePaths.push(decodeURIComponent(parts[1]))
                        }
                    } else {
                        finalStoragePaths.push(rawUrl)
                    }
                } catch (_) {
                    finalStoragePaths.push(rawUrl)
                }
            }

            let filesDeletedCount = 0
            let deleteErrorResult = null

            // A. Delete files from Storage bucket
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

            // B. Update visit record: remove 'fotos' array and legacy keys containing 'foto'
            const updatedRespostas = { ...oldVisit.respostas }
            delete updatedRespostas.fotos

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
                console.log(`[CLEANUP] Cleaned JSON for visit ${oldVisit.id}.`)
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
                message: `Cleanup successful for visits older than ${daysThreshold} days.`,
                cutoffDate,
                totalOldVisitsProcessed: visitsWithPhotos.length,
                totalFilesDeleted,
                visitsUpdatedCount: visitsUpdated.length,
                visitsUpdated,
                filesFailedToDelete
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    } catch (error: any) {
        console.error('[CLEANUP] Critical Error:', error)
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
