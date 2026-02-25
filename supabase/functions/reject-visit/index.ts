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
    .update({ status: "rejeitado" })
    .eq("id", id)

  if (error) return new Response("Erro: " + error.message, { status: 500 })

  return new Response(
    `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visita Rejeitada</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f1f5f9;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            color: #334155;
        }
        .card {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            text-align: center;
            max-width: 400px;
            width: 90%;
        }
        .icon-circle {
            width: 80px;
            height: 80px;
            background-color: #fef2f2;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
        }
        .icon-svg {
            width: 40px;
            height: 40px;
            color: #dc2626;
        }
        h1 {
            color: #dc2626;
            margin: 0 0 10px;
            font-size: 24px;
        }
        p {
            color: #64748b;
            line-height: 1.5;
            margin-bottom: 30px;
        }
        .btn {
            display: inline-block;
            background-color: #dc2626;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            transition: background-color 0.2s;
            cursor: pointer;
            border: none;
            font-size: 16px;
        }
        .btn:hover {
            background-color: #b91c1c;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon-circle">
            <svg class="icon-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </div>
        <h1>Visita Rejeitada</h1>
        <p>O registro foi marcado como rejeitado no sistema. O promotor poderá visualizar o status no aplicativo.</p>
        <button onclick="window.close()" class="btn">Fechar Janela</button>
    </div>
</body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;",
        "X-Content-Type-Options": "nosniff"
      }
    }
  )
})
