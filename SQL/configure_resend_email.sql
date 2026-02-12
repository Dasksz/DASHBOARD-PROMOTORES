-- ============================================================================
-- SCRIPT DE CONFIGURAÇÃO DE EMAIL DE ENVIO (RESEND)
-- ============================================================================
-- Este script configura o remetente dos emails no sistema.
--
-- IMPORTANTE:
-- Para enviar emails para terceiros (como hollacesar@gmail.com), você DEVE:
-- 1. Ter um domínio verificado no Resend (ex: app.com).
-- 2. Configurar o 'RESEND_FROM_EMAIL' para um email desse domínio (ex: noreply@app.com).
--
-- Se você NÃO tem domínio verificado, só pode enviar para o email da conta (backofficeprimeios@gmail.com).
-- Nesse caso, o email do remetente deve ser 'onboarding@resend.dev', mas o destinatário falhará se não for o dono.

-- SUBSTITUA 'noreply@seu-dominio-verificado.com' PELO SEU EMAIL REAL VERIFICADO
INSERT INTO public.data_metadata (key, value)
VALUES ('RESEND_FROM_EMAIL', 'noreply@seu-dominio-verificado.com')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Para verificar o valor atual:
-- SELECT * FROM public.data_metadata WHERE key = 'RESEND_FROM_EMAIL';
