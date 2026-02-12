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
    if (old_record && old_record.respostas && Object.keys(old_record.respostas).length > 0) {
       console.log('Skipping: Email already sent (answers existed previously)')
       return new Response(JSON.stringify({ message: 'Skipped: Duplicate event' }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       })
    }

    // Initialize Supabase Client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 4. Resolve Coordinator Email (Robust Logic)
    let targetEmail = record.coordenador_email;

    if (!targetEmail) {
      console.log('Coordinator email missing. Attempting robust lookup...');

      try {
        // A. Get Promoter Code (Role)
        const { data: promoterProfile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', record.id_promotor)
          .single();

        if (profileError || !promoterProfile) {
           console.error('Lookup Failed: Promoter profile not found.', profileError);
        } else {
           const promoterCode = promoterProfile.role;
           console.log(`Promoter Code found: ${promoterCode}`);

           // B. Get Hierarchy (Co-Coordinator Code)
           // Use ilike or upper/lower to match robustly
           const { data: hierarchy, error: hierError } = await supabase
             .from('data_hierarchy')
             .select('cod_cocoord')
             .ilike('cod_promotor', promoterCode)
             .limit(1)
             .maybeSingle(); // maybeSingle allows null without error

           if (hierError) console.error('Lookup Error (Hierarchy):', hierError);

           let coCoordCode = hierarchy?.cod_cocoord;

           if (coCoordCode) {
              console.log(`Co-Coordinator Code found: ${coCoordCode}`);

              // C. Get Co-Coordinator Email
              const { data: coCoordProfile } = await supabase
                .from('profiles')
                .select('email')
                .ilike('role', coCoordCode)
                .limit(1)
                .maybeSingle();

              if (coCoordProfile?.email) {
                 targetEmail = coCoordProfile.email;
                 console.log(`Found Co-Coordinator Email: ${targetEmail}`);
              }
           }
        }

        // D. Fallback 1: General Coordinator
        if (!targetEmail) {
           console.log('Fallback: Looking for General Coordinator...');
           const { data: coordUser } = await supabase
             .from('profiles')
             .select('email')
             .eq('role', 'coord')
             .limit(1)
             .maybeSingle();
           if (coordUser?.email) targetEmail = coordUser.email;
        }

        // E. Fallback 2: Admin
        if (!targetEmail) {
           console.log('Fallback: Looking for Admin...');
           const { data: admUser } = await supabase
             .from('profiles')
             .select('email')
             .eq('role', 'adm')
             .limit(1)
             .maybeSingle();
           if (admUser?.email) targetEmail = admUser.email;
        }

        // F. Update Record if found
        if (targetEmail) {
           console.log(`Updating visit record with resolved email: ${targetEmail}`);
           await supabase
             .from('visitas')
             .update({ coordenador_email: targetEmail })
             .eq('id', record.id);
        }

      } catch (err) {
         console.error('Unexpected error during email lookup:', err);
      }
    }

    if (!targetEmail) {
      console.error('Critical Error: Could not resolve any recipient email.')
      // Return 200 to avoid retries loops, but logged error
      return new Response(JSON.stringify({ error: 'No coordinator email found after lookup' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. Fetch API Key from Metadata
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
    console.log(`Sending email to: ${targetEmail}`);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: targetEmail,
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
