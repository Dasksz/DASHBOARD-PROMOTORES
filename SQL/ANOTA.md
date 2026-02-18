<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Teste de Cores Dashboard</title>
    <style>
        /* Configuração Geral */
        body {
            margin: 0;
            padding: 40px;
            font-family: 'Segoe UI', sans-serif;
            color: white;
            /* Simulando o fundo da tua imagem (Escuro com brilho laranja) */
            background: radial-gradient(circle at 10% 20%, #4a1905 0%, #050505 40%, #000000 100%);
            min-height: 100vh;
        }

        h2 { margin-bottom: 10px; color: #ccc; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
        
        .container {
            display: flex;
            gap: 40px;
            flex-wrap: wrap;
        }

        .section {
            flex: 1;
            min-width: 300px;
        }

        /* ----------------------------------------------------
           1. ESTILO ANTIGO (Similar ao que tens na imagem) 
           ---------------------------------------------------- */
        .card-old {
            /* Azul acinzentado sólido */
            background-color: #1e293b; 
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            margin-bottom: 20px;
            border: 1px solid #334155;
        }

        /* ----------------------------------------------------
           2. ESTILO SUGERIDO (Glassmorphism / Dark Modern)
           ---------------------------------------------------- */
        .card-new {
            /* Preto com 60% de transparência */
            background-color: rgba(10, 10, 10, 0.6); 
            
            /* O Segredo: Desfoque do fundo (Backdrop Filter) */
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px); /* Para Safari */

            /* Borda sutil semi-transparente para definição */
            border: 1px solid rgba(255, 255, 255, 0.08);
            
            padding: 20px;
            border-radius: 12px;
            
            /* Sombra suave */
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
            margin-bottom: 20px;
            transition: transform 0.2s, border-color 0.2s;
        }

        .card-new:hover {
            border-color: rgba(255, 87, 34, 0.4); /* Brilho laranja sutil ao passar o mouse */
            transform: translateY(-2px);
        }

        /* Conteúdo Interno dos Cards (Apenas para visualização) */
        .kpi-title { font-size: 12px; color: #94a3b8; margin-bottom: 5px; }
        .kpi-value { font-size: 24px; font-weight: bold; color: #fff; }
        .icon-placeholder { float: right; font-size: 20px; opacity: 0.5; }

    </style>
</head>
<body>

    <div class="container">
        <!-- Coluna Esquerda: O que tens agora -->
        <div class="section">
            <h2>Estilo Atual (Sólido)</h2>
            <div class="card-old">
                <span class="icon-placeholder">📦</span>
                <div class="kpi-title">VOLUME TOTAL</div>
                <div class="kpi-value">23,272</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 5px;">Quilos (Kg)</div>
            </div>

            <div class="card-old">
                <span class="icon-placeholder">👥</span>
                <div class="kpi-title">COBERTURA</div>
                <div class="kpi-value">38,41%</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 5px;">896 PDVs</div>
            </div>
        </div>

        <!-- Coluna Direita: A Sugestão -->
        <div class="section">
            <h2>Estilo Sugerido (Glass)</h2>
            <div class="card-new">
                <span class="icon-placeholder">📦</span>
                <div class="kpi-title">VOLUME TOTAL</div>
                <div class="kpi-value">23,272</div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 5px;">Quilos (Kg)</div>
            </div>

            <div class="card-new">
                <span class="icon-placeholder">👥</span>
                <div class="kpi-title">COBERTURA</div>
                <div class="kpi-value">38,41%</div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 5px;">896 PDVs</div>
            </div>
        </div>
    </div>

</body>
</html>
