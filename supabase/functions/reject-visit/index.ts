import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const url = new URL(req.url)
  const id = url.searchParams.get("id")

  if (!id) return new Response("ID inválido", { status: 400 })

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  )

  // 1. Check current status
  const { data: currentVisit, error: fetchError } = await supabase
    .from("visitas")
    .select("status")
    .eq("id", id)
    .single()

  if (fetchError || !currentVisit) {
    return new Response("Erro ao buscar visita ou visita não encontrada.", { status: 500 })
  }

  if (currentVisit.status !== 'pendente') {
    return new Response(
      `<html>
        <body style="font-family:sans-serif; text-align:center; padding:50px;">
          <h1 style="color:orange;">Ação já realizada! ⚠️</h1>
          <p>Esta visita já foi processada anteriormente (Status atual: <strong>${currentVisit.status}</strong>).</p>
        </body>
      </html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    )
  }

  // 2. Update if pending
  const { error } = await supabase
    .from("visitas")
    .update({ status: "rejeitado" })
    .eq("id", id)

  if (error) return new Response("Erro: " + error.message, { status: 500 })

  return new Response(
    `<html>
      <body style="font-family:sans-serif; text-align:center; padding:50px;">
        <h1 style="color:red;">Visita Reprovada ❌</h1>
        <p>O registro foi marcado como rejeitado e não será validado.</p>
      </body>
    </html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  )
})
