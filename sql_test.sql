SELECT
  involves_code,
  translate(lower(replace(involves_code, ' ', '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') AS normalized
FROM relacao_rota_involves
LIMIT 5;
