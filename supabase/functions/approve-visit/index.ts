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

  const { error } = await supabase
    .from("visitas")
    .update({ status: "aprovado" })
    .eq("id", id)

  if (error) return new Response("Erro: " + error.message, { status: 500 })

  return new Response(
    `<html>
      <body style="font-family:sans-serif; text-align:center; padding:50px;">
        <h1 style="color:green;">Visita Aprovada! ✅</h1>
        <p>O registro foi atualizado no sistema com sucesso.</p>
      </body>
    </html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  )
})
