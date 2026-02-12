-- ============================================================================
-- SCRIPT DE CONFIGURAÇÃO DE EMAIL VIA BREVO (Antigo Sendinblue)
-- ============================================================================
-- A Brevo oferece um plano gratuito de 300 emails/dia e permite enviar
-- emails usando apenas um remetente verificado (ex: seu gmail), sem precisar
-- de um domínio próprio verificado.
--
-- INSTRUÇÕES:
-- 1. Crie uma conta gratuita em https://www.brevo.com/
-- 2. Verifique o seu email (ex: backofficeprimeios@gmail.com) na Brevo.
-- 3. Vá em Configurações > SMTP & API e crie uma nova Chave de API (v3).
-- 4. Substitua 'SUA_CHAVE_API_V3_AQUI' abaixo pela chave gerada.
-- 5. Substitua 'seu_email_verificado@gmail.com' pelo seu email verificado.

INSERT INTO public.data_metadata (key, value)
VALUES
    ('BREVO_API_KEY', 'SUA_CHAVE_API_V3_AQUI'),
    ('BREVO_SENDER_EMAIL', 'seu_email_verificado@gmail.com')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- OBS: Se configurar a Brevo, o sistema usará ela automaticamente no lugar do Resend.
-- Para voltar ao Resend, basta deletar essas chaves:
-- DELETE FROM public.data_metadata WHERE key IN ('BREVO_API_KEY', 'BREVO_SENDER_EMAIL');
