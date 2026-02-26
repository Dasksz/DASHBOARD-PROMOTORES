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
    console.log('Webhook Payload Received:', JSON.stringify(payload)); // Full Raw Payload

    const record = payload.record // The new state of the row
    const old_record = payload.old_record // The previous state

    console.log('Processing Visit ID:', record.id)
    console.log('Status:', record.status)
    console.log('Checkout At:', record.checkout_at)
    console.log('Old Checkout At:', old_record ? old_record.checkout_at : 'N/A')
    console.log('Answers:', JSON.stringify(record.respostas))

    // 1. Validation: Only process if status is 'pendente'
    if (record.status !== 'pendente') {
      console.log('Skipping: Status is not pendente')
      return new Response(JSON.stringify({ message: 'Skipped: Not pendente' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Validation: Ensure Check-out is complete (Contains checkout time)
    const hasCheckout = !!record.checkout_at;

    if (!hasCheckout) {
      console.log('Skipping: Visit incomplete (Check-in only, missing checkout_at)')
      return new Response(JSON.stringify({ message: 'Skipped: Incomplete visit' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Validation: Prevent Duplicate Emails (Only send on transition to complete)
    // If old_record existed and WAS checked out, skip.
    if (old_record) {
        const hadCheckout = !!old_record.checkout_at;

        if (hadCheckout) {
             console.log('Skipping: Email already sent (visit was already checked out)')
             return new Response(JSON.stringify({ message: 'Skipped: Duplicate event' }), {
               headers: { ...corsHeaders, 'Content-Type': 'application/json' },
             })
        } else {
             console.log('New Checkout detected (Old was null/empty). Proceeding...');
        }
    } else {
        console.log('No old_record provided (Insert or fresh state). Proceeding...');
    }

    // 3.5. Validation: Conditional Sending Rule (Off-Route vs Survey)
    // Rule: Send IF (OffRoute) OR (HasSurvey). Skip otherwise.
    const answers = record.respostas || {};
    const isOffRoute = answers.is_off_route === true;

    // Check for actual survey content (exclude system keys)
    const systemKeys = ['is_off_route', 'foto_url', 'visit_date_ref'];
    const surveyKeys = Object.keys(answers).filter(k => !systemKeys.includes(k));
    const hasSurvey = surveyKeys.length > 0;

    console.log(`Validation Check: OffRoute=${isOffRoute}, HasSurvey=${hasSurvey} (${surveyKeys.length} keys)`);

    if (!isOffRoute && !hasSurvey) {
       console.log('Skipping: In-Route visit without survey answers.');
       return new Response(JSON.stringify({ message: 'Skipped: No survey for in-route visit' }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       })
    }

    // Initialize Supabase Client with Service Role Key to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Start fetching API keys concurrently
    const apiKeysPromise = supabase
      .from('data_metadata')
      .select('key, value')
      .in('key', ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'RESEND_TEST_EMAIL', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL'])
      .then((res) => res)

    // Metadata for Email Content
    let promoterName = record.id_promotor; // Fallback
    let clientName = record.client_code || record.id_cliente; // Fallback
    let targetEmail = record.coordenador_email;

    // --- OPTIMIZED PARALLEL LOOKUPS ---
    // Fetch critical data in parallel:
    // 1. Promoter Profile (for natural hierarchy lookup & email fallback)
    // 2. Client Info (for display name)
    // 3. Fixed Promoter Assignment (for client-specific routing)

    const clientCodeForLookup = record.client_code || record.id_cliente;
    const normalizedClientCode = clientCodeForLookup ? String(clientCodeForLookup).trim() : null;

    console.log('Starting parallel metadata lookups...');
    
    const [promoterProfileRes, clientInfoRes, assignmentRes] = await Promise.all([
        // 1. Promoter Profile
        supabase.from('profiles').select('email, role').eq('id', record.id_promotor).single(),

        // 2. Client Info
        normalizedClientCode ?
            supabase.from('data_clients').select('fantasia, razaosocial').eq('codigo_cliente', normalizedClientCode).maybeSingle() :
            Promise.resolve({ data: null, error: null }),

        // 3. Fixed Assignment
        normalizedClientCode ?
            supabase.from('data_client_promoters').select('promoter_code').eq('client_code', normalizedClientCode).maybeSingle() :
            Promise.resolve({ data: null, error: null })
    ]);

    // Process Initial Results
    const promoterProfile = promoterProfileRes.data;
    const clientInfo = clientInfoRes.data;
    const assignmentData = assignmentRes.data;

    // Resolve Client Name
    if (clientInfo) {
        clientName = clientInfo.fantasia || clientInfo.razaosocial || clientName;
    }

    // Determine Promoter Codes needed for Hierarchy Lookup
    const naturalPromoterCode = promoterProfile?.role ? promoterProfile.role.trim() : null;
    const fixedPromoterCode = assignmentData?.promoter_code ? assignmentData.promoter_code.trim() : null;

    // Determine Hierarchy Lookups needed
    // We need to look up hierarchy info for BOTH codes if they exist and are different
    // to correctly resolve names and co-coord codes according to priority.

    const hierarchyLookups = [];
    const lookupMap = new Map(); // Maps 'natural' or 'fixed' -> index in hierarchyResults

    if (fixedPromoterCode) {
        lookupMap.set('fixed', hierarchyLookups.length);
        hierarchyLookups.push(
            supabase.from('data_hierarchy').select('nome_promotor, cod_cocoord').ilike('cod_promotor', fixedPromoterCode).limit(1).maybeSingle()
        );
    }

    if (naturalPromoterCode && naturalPromoterCode !== fixedPromoterCode) {
        lookupMap.set('natural', hierarchyLookups.length);
        hierarchyLookups.push(
             supabase.from('data_hierarchy').select('nome_promotor, cod_cocoord').ilike('cod_promotor', naturalPromoterCode).limit(1).maybeSingle()
        );
    } else if (naturalPromoterCode && naturalPromoterCode === fixedPromoterCode) {
        // Reuse fixed lookup if codes are same
        lookupMap.set('natural', lookupMap.get('fixed'));
    }

    // Execute Hierarchy Lookups
    console.log(`Executing ${hierarchyLookups.length} hierarchy lookups...`);
    const hierarchyResults = hierarchyLookups.length > 0 ? await Promise.all(hierarchyLookups) : [];

    // Extract Data Helper
    const getHierarchyData = (type) => {
        const index = lookupMap.get(type);
        if (index !== undefined && hierarchyResults[index]) {
            return hierarchyResults[index].data;
        }
        return null;
    };

    const fixedHierarchy = getHierarchyData('fixed');
    const naturalHierarchy = getHierarchyData('natural');

    // --- RESOLVE PROMOTER NAME ---
    // Priority: Fixed Hierarchy Name > Natural Hierarchy Name > Natural Profile Email > ID
    if (fixedHierarchy?.nome_promotor) {
        promoterName = fixedHierarchy.nome_promotor;
        console.log(`Resolved Promoter Name (Fixed): ${promoterName}`);
    } else if (naturalHierarchy?.nome_promotor) {
        promoterName = naturalHierarchy.nome_promotor;
        console.log(`Resolved Promoter Name (Natural): ${promoterName}`);
    } else if (promoterProfile?.email) {
        promoterName = promoterProfile.email.split('@')[0];
        console.log(`Resolved Promoter Name (Email): ${promoterName}`);
    }

    // --- RESOLVE CO-COORDINATOR CODE ---
    let coCoordCode = null;
    // Priority: Fixed Hierarchy CoCoord > Record CoCoord > Natural Hierarchy CoCoord
    if (fixedHierarchy?.cod_cocoord) {
        coCoordCode = fixedHierarchy.cod_cocoord.trim();
        console.log(`Resolved Co-Coord Code (Fixed): ${coCoordCode}`);
    } else if (record.cod_cocoord) {
        coCoordCode = record.cod_cocoord.trim();
        console.log(`Resolved Co-Coord Code (Record): ${coCoordCode}`);
    } else if (naturalHierarchy?.cod_cocoord) {
        coCoordCode = naturalHierarchy.cod_cocoord.trim();
        console.log(`Resolved Co-Coord Code (Natural): ${coCoordCode}`);
    }

    // --- RESOLVE COORDINATOR EMAIL ---
    // Now we need the email for the resolved coCoordCode

    if (!targetEmail || coCoordCode) { // If targetEmail already set in record, we might skip, but logic implies we overwrite or robustly find. Original logic checks (!targetEmail || fixedCoCoordCode).
      console.log('Resolving Target Email...');
      try {
        // A. Primary: Co-Coordinator Profile
        if (coCoordCode) {
             const { data: coCoordProfile } = await supabase
              .from('profiles')
              .select('email')
              .ilike('role', coCoordCode)
              .limit(1)
              .maybeSingle();
              
            if (coCoordProfile?.email) {
               targetEmail = coCoordProfile.email;
               console.log(`Found Co-Coordinator Email: ${targetEmail}`);
            } else {
                console.log(`Co-Coordinator Code '${coCoordCode}' not found in profiles.`);
            }
        }

        // B. Fallback 1: General Coordinator (ILIKE)
        if (!targetEmail) {
           console.log('Fallback 1: Looking for General Coordinator (coord)...');
           const { data: coordUser } = await supabase
             .from('profiles')
             .select('email')
             .ilike('role', 'coord')
             .limit(1)
             .maybeSingle();
           if (coordUser?.email) {
               targetEmail = coordUser.email;
               console.log(`Found General Coordinator Email: ${targetEmail}`);
           }
        }

        // C. Fallback 2: Admin (ILIKE 'adm' OR 'admin')
        if (!targetEmail) {
           console.log('Fallback 2: Looking for Admin (adm)...');
           // Parallelize Admin Check if possible, or keep sequential as it's fallback
           let { data: admUser } = await supabase
             .from('profiles')
             .select('email')
             .ilike('role', 'adm')
             .limit(1)
             .maybeSingle();
             
           if (!admUser) {
               console.log('Fallback 2b: Looking for Admin (admin)...');
               const { data: adminUser } = await supabase
                 .from('profiles')
                 .select('email')
                 .ilike('role', 'admin')
                 .limit(1)
                 .maybeSingle();
               admUser = adminUser;
           }

           if (admUser?.email) {
               targetEmail = admUser.email;
               console.log(`Found Admin Email: ${targetEmail}`);
           }
        }

        // D. Update Record if found
        if (targetEmail) {
           console.log(`Updating visit record with resolved email: ${targetEmail}`);
           // Fire and forget update to not block email sending? Or wait?
           // Original waited. We'll wait to ensure consistency.
           const { error: updateError } = await supabase
             .from('visitas')
             .update({ coordenador_email: targetEmail })
             .eq('id', record.id);
             
           if (updateError) console.error('Error updating visit record:', updateError);
        } else {
            console.error('Critical: Failed to resolve ANY email recipient.');
        }

      } catch (err) {
         console.error('Unexpected error during email lookup:', err);
      }
    }

    if (!targetEmail) {
      console.error('Critical Error: Could not resolve any recipient email.')
      return new Response(JSON.stringify({ error: 'No coordinator email found after lookup' }), {
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. Fetch API Key AND From Email from Metadata
    // Await the promise initiated at the start
    const { data: keyData, error: keyError } = await apiKeysPromise

    if (keyError || !keyData) {
      console.error('Error fetching API Key:', keyError)
      return new Response(JSON.stringify({ error: 'API Key not found' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKeyObj = keyData.find(k => k.key === 'RESEND_API_KEY');
    const fromEmailObj = keyData.find(k => k.key === 'RESEND_FROM_EMAIL');
    const testEmailObj = keyData.find(k => k.key === 'RESEND_TEST_EMAIL');
    const brevoKeyObj = keyData.find(k => k.key === 'BREVO_API_KEY');
    const brevoSenderObj = keyData.find(k => k.key === 'BREVO_SENDER_EMAIL');

    // Determine Provider: Brevo (Priority) or Resend (Fallback)
    const USE_BREVO = !!brevoKeyObj;

    if (!USE_BREVO && !apiKeyObj) {
         console.error('Error: Neither BREVO_API_KEY nor RESEND_API_KEY found in metadata');
         return new Response(JSON.stringify({ error: 'No email provider configured' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         })
    }

    let SENDER_EMAIL = 'onboarding@resend.dev'; // Default for Resend
    if (USE_BREVO) {
        SENDER_EMAIL = brevoSenderObj ? brevoSenderObj.value : 'nao-responda@app.com';
    } else {
        SENDER_EMAIL = fromEmailObj ? fromEmailObj.value : 'onboarding@resend.dev';
    }

    // Test Mode Logic: Override recipient if RESEND_TEST_EMAIL is set (applies to both providers for safety)
    let originalTargetEmail = null;
    if (testEmailObj && testEmailObj.value) {
        console.log(`TEST MODE ACTIVE: Redirecting email from ${targetEmail} to ${testEmailObj.value}`);
        originalTargetEmail = targetEmail;
        targetEmail = testEmailObj.value;
    }

    // 6. Construct Email (Styled)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'https://dldsocponbjthqxhmttj.supabase.co';
    const approveUrl = `${supabaseUrl}/functions/v1/approve-visit?id=${record.id}`
    const rejectUrl = `${supabaseUrl}/functions/v1/reject-visit?id=${record.id}`

    // Formatting Dates
    const visitDate = new Date(record.data_visita).toLocaleDateString('pt-BR');
    const checkInTime = new Date(record.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    const checkOutTime = record.checkout_at ? new Date(record.checkout_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : '--:--';

    // Parsing Survey Answers Table
    let answersRows = '';
    // const answers = record.respostas; // Removed duplicate declaration (already declared above)
    if (answers && typeof answers === 'object' && Object.keys(answers).length > 0) {
        for (const [key, value] of Object.entries(answers)) {
            // Clean keys if needed (e.g. remove snake_case) or use label map
            const questionLabel = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            // Determine if value needs special formatting (e.g. image URL)
            let displayValue = String(value);
            if (displayValue.startsWith('http') && (displayValue.includes('supabase') || displayValue.includes('.png') || displayValue.includes('.jpg'))) {
                displayValue = `<a href="${displayValue}" style="color: #2563eb; text-decoration: underline;">Ver Foto</a>`;
            }

            answersRows += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px 16px; color: #475569;">${questionLabel}</td>
                <td style="padding: 12px 16px; color: #1e293b; font-weight: 500;">${displayValue}</td>
            </tr>`;
        }
    } else {
        answersRows = `
            <tr>
                <td colspan="2" style="padding: 16px; color: #64748b; text-align: center; font-style: italic; background-color: #f8fafc;">
                    Nenhuma resposta registrada nesta visita.
                </td>
            </tr>
        `;
    }

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        
        ${originalTargetEmail ? `
        <!-- Test Mode Banner -->
        <div style="background-color: #fff1f2; border: 1px solid #fda4af; color: #be123c; padding: 12px; border-radius: 6px; margin-bottom: 20px; text-align: center; font-weight: 700;">
            ⚠️ MODO TESTE ATIVO<br>
            <span style="font-weight: 400; font-size: 14px;">Destinatário Original: ${originalTargetEmail}</span>
        </div>
        ` : ''}

        ${isOffRoute ? `
        <!-- Off Route Banner -->
        <div style="background-color: #fff7ed; border: 1px solid #fdba74; color: #9a3412; padding: 12px; border-radius: 6px; margin-bottom: 20px; text-align: center; font-weight: 700;">
            ⚠️ VISITA FORA DE ROTA
            <br><span style="font-weight: 400; font-size: 14px;">Esta visita foi realizada fora da data programada.</span>
        </div>
        ` : ''}

        <!-- Header -->
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 700;">Nova Visita para Validação: <span style="color: #2563eb;">${clientName}</span></h2>
        <p style="color: #64748b; font-size: 14px; margin-bottom: 24px;">
            <strong>App Promotores</strong> &lt;noreply@app.com&gt; para <a href="#" style="color: #64748b; text-decoration: none;">${targetEmail}</a>
        </p>

        <!-- Title -->
        <h3 style="color: #0f172a; font-size: 18px; font-weight: 700; margin-bottom: 12px;">Relatório de Visita</h3>
        <p style="color: #475569; font-size: 14px; margin-bottom: 20px;">Uma nova visita foi finalizada e precisa da sua validação.</p>

        <!-- Summary Card -->
        <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; border-radius: 4px; padding: 20px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding-bottom: 8px; width: 100px; color: #64748b; font-size: 14px; font-weight: 700;">Promotor:</td>
                    <td style="padding-bottom: 8px; color: #334155; font-size: 14px;">${promoterName}</td>
                </tr>
                <tr>
                    <td style="padding-bottom: 8px; color: #64748b; font-size: 14px; font-weight: 700;">Cliente:</td>
                    <td style="padding-bottom: 8px; color: #334155; font-size: 14px;">${clientName}</td>
                </tr>
                <tr>
                    <td style="padding-bottom: 8px; color: #64748b; font-size: 14px; font-weight: 700;">Data:</td>
                    <td style="padding-bottom: 8px; color: #334155; font-size: 14px;">${visitDate}</td>
                </tr>
                <tr>
                    <td style="padding-bottom: 8px; color: #64748b; font-size: 14px; font-weight: 700;">Check-in:</td>
                    <td style="padding-bottom: 8px; color: #334155; font-size: 14px;">${checkInTime}</td>
                </tr>
                <tr>
                    <td style="color: #64748b; font-size: 14px; font-weight: 700;">Check-out:</td>
                    <td style="color: #334155; font-size: 14px;">${checkOutTime}</td>
                </tr>
            </table>
        </div>

        <!-- Survey Table -->
        <h4 style="color: #0f172a; font-size: 16px; font-weight: 700; margin-bottom: 12px;">Respostas da Pesquisa:</h4>
        <div style="border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 30px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead style="background-color: #f1f5f9;">
                    <tr>
                        <th style="text-align: left; padding: 12px 16px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #e2e8f0;">Pergunta</th>
                        <th style="text-align: left; padding: 12px 16px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #e2e8f0;">Resposta</th>
                    </tr>
                </thead>
                <tbody>
                    ${answersRows}
                </tbody>
            </table>
        </div>

        <!-- Observações Extra -->
        ${record.observacao ? `
        <div style="margin-bottom: 30px; background-color: #fffbeb; padding: 15px; border-radius: 6px; border: 1px solid #fcd34d;">
            <strong style="color: #92400e; display: block; margin-bottom: 5px;">Observações:</strong>
            <span style="color: #b45309;">${record.observacao}</span>
        </div>
        ` : ''}

        <!-- Actions -->
        <div style="text-align: center; margin-bottom: 24px;">
            <p style="color: #475569; font-size: 14px; margin-bottom: 16px;">Clique abaixo para validar esta visita no painel:</p>
            <div>
                <a href="${approveUrl}" style="display: inline-block; background-color: #22c55e; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 14px; margin-right: 12px;">Aprovar Pesquisa</a>
                <a href="${rejectUrl}" style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 14px;">Rejeitar Pequisa</a>
            </div>
        </div>

        <!-- Footer -->
        <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
            Este é um e-mail automático do sistema de Dashboard Promotores.
        </p>
      </div>
    `

    // 7. Send Email via Provider
    if (USE_BREVO) {
        // --- BREVO (Sendinblue) ---
        console.log(`Sending email via Brevo to: ${targetEmail} from: ${SENDER_EMAIL}`);
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': brevoKeyObj.value,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sender: { email: SENDER_EMAIL, name: 'App Promotores' },
            to: [{ email: targetEmail }],
            subject: `Nova Visita: ${clientName}`,
            htmlContent: htmlContent,
          }),
        })

        const data = await res.json();

        if (!res.ok) {
            console.error('Brevo API Error:', data);
            return new Response(JSON.stringify({ error: 'Failed to send email via Brevo', details: data }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        console.log('Email sent successfully via Brevo:', data.messageId);
        return new Response(JSON.stringify({ success: true, provider: 'brevo', id: data.messageId }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } else {
        // --- RESEND ---
        console.log(`Sending email via Resend to: ${targetEmail} from: ${SENDER_EMAIL}`);
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKeyObj.value}`,
          },
          body: JSON.stringify({
            from: SENDER_EMAIL,
            to: targetEmail,
            subject: `Nova Visita: ${clientName}`,
            html: htmlContent,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
            console.error('Resend API Error:', data);
            return new Response(JSON.stringify({ error: 'Failed to send email via Resend', details: data }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        console.log('Email sent successfully via Resend:', data.id);
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

  } catch (error) {
    console.error('Function Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
