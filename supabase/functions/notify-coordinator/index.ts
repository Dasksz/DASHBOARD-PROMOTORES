// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"


// Helper to safely format dates to BRT (UTC-3) without relying on Intl/ICU data in Deno
function formatBRT(dateInput: any) {
    if (!dateInput) return { dateStr: '--/--/----', timeStr: '--:--' };

    let normalizedStr = dateInput;
    if (typeof dateInput === 'string') {
        normalizedStr = dateInput.replace(' ', 'T');
        if (normalizedStr.endsWith('+00')) {
             normalizedStr = normalizedStr.replace('+00', 'Z');
        }
    }

    const date = new Date(normalizedStr);
    if (isNaN(date.getTime())) return { dateStr: '--/--/----', timeStr: '--:--' };

    // Calculate BRT offset (UTC-3)
    const offset = -3 * 60 * 60 * 1000;
    const brtDate = new Date(date.getTime() + offset);

    const dd = String(brtDate.getUTCDate()).padStart(2, '0');
    const mm = String(brtDate.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = brtDate.getUTCFullYear();

    const hours = String(brtDate.getUTCHours()).padStart(2, '0');
    const minutes = String(brtDate.getUTCMinutes()).padStart(2, '0');

    return {
        dateStr: `${dd}/${mm}/${yyyy}`,
        timeStr: `${hours}:${minutes}`
    };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function validCoordinates(lat, lng) {
    return lat !== null && lat !== undefined && lat !== '' && lng !== null && lng !== undefined && lng !== '' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;
}
function distanceMeters(a,b) {
    const rad=n=>n*Math.PI/180,dLat=rad(b.lat-a.lat),dLng=rad(b.lng-a.lng);
    const h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;
    return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let claimedGeoVisitId = null;
  let notificationClient = null;
  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceKey || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') !== serviceKey) return new Response(JSON.stringify({error:'Unauthorized'}), {status:401,headers:{...corsHeaders,'Content-Type':'application/json'}});
    const payload = await req.json()
    console.log('Visit notification webhook received');

    let record = payload.record // The new state of the row
    const old_record = payload.old_record // The previous state

    console.log('Processing Visit ID:', record.id)
    console.log('Status:', record.status)
    console.log('Checkout At:', record.checkout_at)
    console.log('Old Checkout At:', old_record ? old_record.checkout_at : 'N/A')


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

    // 3. Validation: Prevent Duplicate Processing
    if (old_record) {
        const hadCheckout = !!old_record.checkout_at;

        if (hadCheckout) {
             console.log('Skipping: Already processed (visit was already checked out)')
             return new Response(JSON.stringify({ message: 'Skipped: Duplicate event' }), {
               headers: { ...corsHeaders, 'Content-Type': 'application/json' },
             })
        } else {
             console.log('New Checkout detected (Old was null/empty). Proceeding...');
        }
    } else {
        console.log('No old_record provided (Insert or fresh state). Proceeding...');
    }

    // Initialize Supabase Client with Service Role Key to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    notificationClient = supabase;
    const {data: storedVisit, error: storedError} = await supabase.from('visitas').select('*').eq('id',record.id).single();
    if (storedError || !storedVisit) throw new Error('Visit not found');
    record = storedVisit;
    let registered = {lat:record.client_latitude,lng:record.client_longitude};
    if (!validCoordinates(registered.lat,registered.lng)) {
        const {data: coord,error: coordError} = await supabase.from('data_client_coordinates').select('lat,lng').eq('client_code',record.client_code || record.id_cliente).maybeSingle();
        if (coordError) throw coordError;
        if (coord) registered=coord;
    }
    const geoPoints = [
        {label:'Check-in',lat:record.latitude,lng:record.longitude},
        {label:'Checkout',lat:record.checkout_latitude,lng:record.checkout_longitude},
        {label:'Cliente',lat:registered.lat,lng:registered.lng}
    ];
    const geoDistances = [[0,2],[1,2],[0,1]].map(([i,j]) => {
        const a=geoPoints[i],b=geoPoints[j];
        return {label:`${a.label} ↔ ${b.label}`,meters:validCoordinates(a.lat,a.lng) && validCoordinates(b.lat,b.lng) ? distanceMeters(a,b) : null};
    });
    const maxDistance = Math.max(0,...geoDistances.map(pair=>pair.meters || 0));
    const hasGeoAlert = maxDistance > 150;

    // 3.5. Validation & Auto-Approval Rule (In-Route vs Off-Route)
    const answers = record.respostas || {};
    const isOffRoute = answers.is_off_route === true;

    console.log(`Validation Check: OffRoute=${isOffRoute}`);

    // If visit is IN-ROUTE (not off-route):
    // Auto-approve automatically in DB and skip sending email to coordinator.
    if (!isOffRoute) {
      console.log(`Visit ID ${record.id} is IN-ROUTE. Auto-approving visit and skipping email...`);
      const { error: approveError } = await supabase
        .from('visitas')
        .update({ status: 'aprovado' })
        .eq('id', record.id);

      if (approveError) {
        console.error('Error auto-approving in-route visit:', approveError);
        return new Response(JSON.stringify({ error: 'Failed to auto-approve in-route visit', details: approveError }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Visit ID ${record.id} successfully auto-approved.`);
      if (!hasGeoAlert) return new Response(JSON.stringify({ message: 'Auto-approved: In-route visit', visit_id: record.id, status: 'aprovado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for actual survey content (exclude system keys)
    const systemKeys = ['is_off_route', 'foto_url', 'visit_date_ref'];
    const surveyKeys = Object.keys(answers).filter(k => !systemKeys.includes(k));
    const hasSurvey = surveyKeys.length > 0;

    console.log(`Off-Route Visit confirmed. HasSurvey=${hasSurvey} (${surveyKeys.length} keys). Proceeding with email...`);

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

    if (hasGeoAlert) {
        targetEmail = record.coordenador_email?.trim() || null;
        promoterName = naturalHierarchy?.nome_promotor || record.promotor_name || promoterName;
        if (!targetEmail) {
            const code=naturalHierarchy?.cod_cocoord || record.cod_cocoord;
            if (code) {
                const {data: candidates,error: recipientError} = await supabase.from('profiles').select('email').ilike('role',code.trim()).eq('status','aprovado');
                if (recipientError) throw recipientError;
                const emails=[...new Set((candidates || []).map(p=>p.email?.trim()).filter(Boolean))];
                if (emails.length===1) targetEmail=emails[0];
            }
        }
        if (!targetEmail) throw new Error('Coordinator email is missing or ambiguous for this visit');
    } else {
    // --- RESOLVE COORDINATOR EMAIL ---
    // Now we need the email for the resolved coCoordCode

    if (!targetEmail || coCoordCode) {
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

    }

    // 5. Fetch API Key AND From Email from Metadata
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

    // Test Mode Logic: Override recipient if RESEND_TEST_EMAIL is set
    let originalTargetEmail = null;
    if (testEmailObj && testEmailObj.value) {
        console.log(`TEST MODE ACTIVE: Redirecting email from ${targetEmail} to ${testEmailObj.value}`);
        originalTargetEmail = targetEmail;
        targetEmail = testEmailObj.value;
    }

    if (hasGeoAlert) {
        const {error: claimError} = await supabase.from('visit_geo_alerts').insert({visit_id:record.id,recipient:targetEmail,max_distance_m:maxDistance});
        if (claimError?.code === '23505') return new Response(JSON.stringify({message:'Geographic alert already claimed or sent'}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
        if (claimError) throw claimError;
        claimedGeoVisitId=record.id;
    }

    // 6. Construct Email (Styled)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'https://dldsocponbjthqxhmttj.supabase.co';
    const approveUrl = `${supabaseUrl}/functions/v1/approve-visit?id=${record.id}`
    const rejectUrl = `${supabaseUrl}/functions/v1/reject-visit?id=${record.id}`

    // Formatting Dates
    const visitDate = formatBRT(record.data_visita).dateStr;
    const checkInTime = formatBRT(record.created_at).timeStr;
    const checkOutTime = record.checkout_at ? formatBRT(record.checkout_at).timeStr : '--:--';

    // Parsing Survey Answers Table
    let answersRows = '';
    if (answers && typeof answers === 'object' && Object.keys(answers).length > 0) {
        for (const [key, value] of Object.entries(answers)) {
            const questionLabel = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            let displayValue = String(value);

            if (key === 'fotos' && Array.isArray(value)) {
                displayValue = value.map(foto => {
                    const tipoLabel = foto.tipo ? foto.tipo.toUpperCase() : 'GERAL';
                    return `<a href="${foto.url}" style="color: #2563eb; text-decoration: underline; margin-right: 8px;">Ver Foto (${tipoLabel})</a>`;
                }).join('<br>');
            } else if (typeof displayValue === 'string' && displayValue.startsWith('http') && (displayValue.includes('supabase') || displayValue.includes('.png') || displayValue.includes('.jpg'))) {
                displayValue = `<a href="${displayValue}" style="color: #2563eb; text-decoration: underline;">Ver Foto</a>`;
            } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                displayValue = JSON.stringify(value);
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
                    Visita Fora de Rota: Nenhum questionário foi exigido no momento do registro.
                </td>
            </tr>
        `;
    }

    let surveySection = '';
    let actionsSection = '';

    if (hasSurvey) {
        surveySection = `
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
        `;
    }

    actionsSection = `
    <!-- Actions -->
    <div style="text-align: center; margin-bottom: 24px;">
        <p style="color: #475569; font-size: 14px; margin-bottom: 16px;">Clique abaixo para validar esta visita no painel:</p>
        <div>
            <a href="${approveUrl}" style="display: block; width: 100%; max-width: 300px; margin: 0 auto 12px auto; box-sizing: border-box; background-color: #22c55e; color: #ffffff; padding: 14px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 14px;">Aprovar Pesquisa</a>
            <a href="${rejectUrl}" style="display: block; width: 100%; max-width: 300px; margin: 0 auto; box-sizing: border-box; background-color: #dc2626; color: #ffffff; padding: 14px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 14px;">Rejeitar Pesquisa</a>
        </div>
    </div>
    `;

    if (hasGeoAlert && !isOffRoute) actionsSection = '';
    const pointLinks = geoPoints.filter(point=>validCoordinates(point.lat,point.lng)).map(point => `<a href="https://www.google.com/maps?q=${Number(point.lat)},${Number(point.lng)}" style="display:block;margin:8px 0">${point.label}: abrir no mapa</a>`).join('');
    const geoBanner = hasGeoAlert ? `<div style="background:#fef2f2;border:1px solid #f87171;padding:16px;margin-bottom:20px;color:#991b1b"><strong>ALERTA DE LOCALIZAÇÃO — DISTÂNCIA ACIMA DE 150 METROS</strong>${geoDistances.map(pair=>`<p>${pair.label}: ${pair.meters === null ? 'Localização não registrada' : pair.meters.toFixed(1) + ' m'}${pair.meters !== null && pair.meters > 150 ? ' — acima do limite' : ''}</p>`).join('')}<p>Precisão do GPS: check-in ${record.checkin_accuracy == null ? 'não registrada' : Math.round(record.checkin_accuracy)+' m'}; checkout ${record.checkout_accuracy == null ? 'não registrada' : Math.round(record.checkout_accuracy)+' m'}.</p>${pointLinks}<a href="https://dasksz.github.io/DASHBOARD-PROMOTORES/#feed">Abrir Feed de Visitas</a></div>` : '';
    const emailSubject = hasGeoAlert ? `Alerta de localização (>150 m): ${clientName}` : `Nova Visita Fora de Rota: ${clientName}`;
    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        
        ${originalTargetEmail ? `
        <!-- Test Mode Banner -->
        <div style="background-color: #fff1f2; border: 1px solid #fda4af; color: #be123c; padding: 12px; border-radius: 6px; margin-bottom: 20px; text-align: center; font-weight: 700;">
            ⚠️ MODO TESTE ATIVO<br>
            <span style="font-weight: 400; font-size: 14px;">Destinatário Original: ${originalTargetEmail}</span>
        </div>
        ` : ''}

        ${geoBanner}
        <!-- Off Route Banner -->
        ${isOffRoute ? `
        <div style="background-color: #fff7ed; border: 1px solid #fdba74; color: #9a3412; padding: 12px; border-radius: 6px; margin-bottom: 20px; text-align: center; font-weight: 700;">
            ⚠️ VISITA FORA DE ROTA
            <br><span style="font-weight: 400; font-size: 14px;">Esta visita foi realizada fora da data programada.</span>
        </div>

        ` : ''}
        <!-- Header -->
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 700;">${hasGeoAlert ? 'Alerta de localização da visita' : 'Nova Visita Fora de Rota para Validação'}: <span style="color: #2563eb;">${clientName}</span></h2>
        <p style="color: #64748b; font-size: 14px; margin-bottom: 24px;">
            <strong>App Promotores</strong> &lt;noreply@app.com&gt; para <a href="#" style="color: #64748b; text-decoration: none;">${targetEmail}</a>
        </p>

        <!-- Title -->
        <h3 style="color: #0f172a; font-size: 18px; font-weight: 700; margin-bottom: 12px;">${hasGeoAlert ? 'Relatório de localização da visita' : 'Relatório de Visita Fora de Rota'}</h3>
        <p style="color: #475569; font-size: 14px; margin-bottom: 20px;">${hasGeoAlert ? 'Uma visita foi finalizada com distância superior a 150 metros entre os pontos registrados.' : 'Uma nova visita fora de rota foi finalizada e precisa da sua validação.'}</p>

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

        ${surveySection}

        <!-- Observações Extra -->
        ${record.observacao ? `
        <div style="margin-bottom: 30px; background-color: #fffbeb; padding: 15px; border-radius: 6px; border: 1px solid #fcd34d;">
            <strong style="color: #92400e; display: block; margin-bottom: 5px;">Observações:</strong>
            <span style="color: #b45309;">${record.observacao}</span>
        </div>
        ` : ''}

        ${actionsSection}

        <!-- Footer -->
        <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
            Este é um e-mail automático do sistema de Dashboard Promotores.
        </p>
      </div>
    `

    // 7. Send Email via Provider
    if (USE_BREVO) {
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
            subject: emailSubject,
            htmlContent: htmlContent,
          }),
        })

        const data = await res.json();

        if (!res.ok) {
            console.error('Brevo API Error:', data);
            if (claimedGeoVisitId) { await supabase.from('visit_geo_alerts').delete().eq('visit_id',claimedGeoVisitId).is('sent_at',null); claimedGeoVisitId=null; }
            return new Response(JSON.stringify({ error: 'Failed to send email via Brevo', details: data }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        if (claimedGeoVisitId) await supabase.from('visit_geo_alerts').update({sent_at:new Date().toISOString(),provider_message_id:data.messageId}).eq('visit_id',claimedGeoVisitId);
        claimedGeoVisitId=null;
        console.log('Email sent successfully via Brevo:', data.messageId);
        return new Response(JSON.stringify({ success: true, provider: 'brevo', id: data.messageId }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } else {
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
            subject: emailSubject,
            html: htmlContent,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
            console.error('Resend API Error:', data);
            if (claimedGeoVisitId) { await supabase.from('visit_geo_alerts').delete().eq('visit_id',claimedGeoVisitId).is('sent_at',null); claimedGeoVisitId=null; }
            return new Response(JSON.stringify({ error: 'Failed to send email via Resend', details: data }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        if (claimedGeoVisitId) await supabase.from('visit_geo_alerts').update({sent_at:new Date().toISOString(),provider_message_id:data.id}).eq('visit_id',claimedGeoVisitId);
        claimedGeoVisitId=null;
        console.log('Email sent successfully via Resend:', data.id);
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

  } catch (error) {
    if (claimedGeoVisitId && notificationClient) await notificationClient.from('visit_geo_alerts').delete().eq('visit_id',claimedGeoVisitId).is('sent_at',null);
    console.error('Function Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

