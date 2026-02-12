-- ============================================================================
-- SCRIPT DE CONFIGURAÇÃO DE MODO DE TESTE DE EMAIL
-- ============================================================================
-- Como você não possui um domínio verificado no Resend, você só pode enviar
-- emails para o endereço cadastrado na sua conta Resend (backofficeprimeios@gmail.com).
--
-- Este script configura o sistema para redirecionar TODOS os emails para o seu
-- email de teste, independentemente de quem seja o coordenador real.
-- O corpo do email avisará quem seria o destinatário original.

INSERT INTO public.data_metadata (key, value)
VALUES ('RESEND_TEST_EMAIL', 'backofficeprimeios@gmail.com')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Para DESATIVAR o modo de teste (quando tiver domínio verificado):
-- DELETE FROM public.data_metadata WHERE key = 'RESEND_TEST_EMAIL';
