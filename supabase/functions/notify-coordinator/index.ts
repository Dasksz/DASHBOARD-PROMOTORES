import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// Importamos o cliente do Supabase para poder ler a tabela
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  // 1. Recebe os dados do Webhook
  const payload = await req.json()
  const record = payload.record

  // Validação básica: só envia se estiver pendente e tiver e-mail
  if (record.status !== 'pendente' || !record.coordenador_email) {
    return new Response('Ignorado', { status: 200 })
  }

  // 2. Conecta no Supabase para buscar a API Key
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // 3. Busca a chave na sua tabela 'data_metadata'
  const { data: keyData, error: keyError } = await supabase
    .from('data_metadata')
    .select('valor')
    .eq('chave', 'RESEND_API_KEY')
    .single()

  if (keyError || !keyData) {
    console.error("Erro ao buscar API Key:", keyError)
    return new Response('Erro de Configuração: API Key não encontrada', { status: 500 })
  }

  const RESEND_API_KEY = keyData.valor

  // URLs REAIS que você configurou
  const approveUrl = `https://dldsocponbjthqxhmttj.supabase.co/functions/v1/approve-visit?id=${record.id}`;
  const rejectUrl = `https://dldsocponbjthqxhmttj.supabase.co/functions/v1/reject-visit?id=${record.id}`;

  // 4. Monta o HTML do E-mail
  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: #333;">Nova Visita Recebida</h2>
      <p><strong>ID da Visita:</strong> ${record.id}</p>
      <p><strong>Observações:</strong> ${record.observacao || 'Nenhuma'}</p>

      <div style="margin-top: 30px;">
        <a href="${approveUrl}"
           style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin-right: 10px;">
           ✅ APROVAR
        </a>
        <a href="${rejectUrl}"
           style="background-color: #dc3545; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
           ❌ REPROVAR
        </a>
      </div>
      <p style="font-size: 12px; color: #999; margin-top: 20px;">Este é um e-mail automático do Dashboard de Promotores.</p>
    </div>
  `

  // 5. Envia o e-mail usando o Resend
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
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  })
})
