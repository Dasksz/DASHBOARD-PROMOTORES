UPDATE relacao_rota_involves
SET involves_code = translate(lower(replace(involves_code, ' ', '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
WHERE involves_code != translate(lower(replace(involves_code, ' ', '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
