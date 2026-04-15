-- 1. Habilitar a extensão que permite tirar acentos
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Atualizar todos os registros existentes para ficar sem acento e em maiúsculo
UPDATE public.config_city_branches
SET cidade = UPPER(unaccent(cidade));

-- 3. Criar uma função para o trigger
CREATE OR REPLACE FUNCTION public.normalize_cidade()
RETURNS TRIGGER AS $$
BEGIN
  NEW.cidade := UPPER(unaccent(NEW.cidade));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Garantir que se o trigger já existir ele será removido antes de recriar
DROP TRIGGER IF EXISTS trg_normalize_cidade ON public.config_city_branches;

-- 5. Criar o trigger na tabela para rodar antes de todo insert/update
CREATE TRIGGER trg_normalize_cidade
BEFORE INSERT OR UPDATE ON public.config_city_branches
FOR EACH ROW
EXECUTE FUNCTION public.normalize_cidade();
