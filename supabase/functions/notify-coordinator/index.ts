// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

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
    const record = payload.record // The new state of the row
    const old_record = payload.old_record // The previous state

    console.log('Webhook received for Visit ID:', record.id)

    // 1. Validation: Only process if status is 'pendente'
    if (record.status !== 'pendente') {
      console.log('Skipping: Status is not pendente')
      return new Response(JSON.stringify({ message: 'Skipped: Not pendente' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Validation: Only process if survey answers exist
    if (!record.respostas || Object.keys(record.respostas).length === 0) {
      console.log('Skipping: No survey answers (Check-in only)')
      return new Response(JSON.stringify({ message: 'Skipped: No answers' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Validation: Prevent Duplicate Emails
    // If old_record exists (UPDATE) and it ALREADY had answers, it means this update is something else (like checkout)
    // We only want to send when answers are FIRST added.
    if (old_record && old_record.respostas && Object.keys(old_record.respostas).length > 0) {
       console.log('Skipping: Email already sent (answers existed previously)')
       return new Response(JSON.stringify({ message: 'Skipped: Duplicate event' }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       })
    }

    // 4. Validation: Coordinator Email must exist
    if (!record.coordenador_email) {
      console.error('Error: No coordinator email found for this visit.')
      // We return 200 to avoid retries from Supabase, but log the error
      return new Response(JSON.stringify({ error: 'No coordinator email' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. Fetch API Key from Database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: keyData, error: keyError } = await supabase
      .from('data_metadata')
      .select('value')
      .eq('key', 'RESEND_API_KEY')
      .single()

    if (keyError || !keyData) {
      console.error('Error fetching API Key:', keyError)
      return new Response(JSON.stringify({ error: 'API Key not found' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const RESEND_API_KEY = keyData.value

    // 6. Construct Email
    // Using the project URL dynamically or falling back to a known structure
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'https://dldsocponbjthqxhmttj.supabase.co';
    const approveUrl = `${supabaseUrl}/functions/v1/approve-visit?id=${record.id}`
    const rejectUrl = `${supabaseUrl}/functions/v1/reject-visit?id=${record.id}`

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <h2 style="color: #333;">Relatório de Visita Concluído</h2>
        <p><strong>Promotor ID:</strong> ${record.id_promotor}</p>
        <p><strong>Cliente:</strong> ${record.client_code || record.id_cliente}</p>
        <p><strong>Data:</strong> ${new Date(record.data_visita).toLocaleString('pt-BR')}</p>

        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Respostas:</h3>
          <pre style="white-space: pre-wrap;">${JSON.stringify(record.respostas, null, 2)}</pre>
          <p><strong>Observações:</strong> ${record.observacao || 'Nenhuma'}</p>
        </div>

        <div style="margin-top: 30px; text-align: center;">
          <a href="${approveUrl}"
             style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin-right: 10px;">
             ✅ APROVAR VISITA
          </a>
          <a href="${rejectUrl}"
             style="background-color: #dc3545; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
             ❌ REPROVAR
          </a>
        </div>
        <p style="font-size: 12px; color: #999; margin-top: 20px; text-align: center;">Este é um e-mail automático do Dashboard de Promotores.</p>
      </div>
    `

    // 7. Send Email via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: record.coordenador_email,
        subject: `Aprovação Necessária: Visita #${record.id}`,
        html: htmlContent,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
        console.error('Resend API Error:', data);
        return new Response(JSON.stringify({ error: 'Failed to send email', details: data }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Function Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
