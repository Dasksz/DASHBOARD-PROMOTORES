function normalizeResearcherCode(c) {
    if (!c) return '';
    return String(c).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, '');
}
console.log(normalizeResearcherCode('ROT A 10'));
console.log(normalizeResearcherCode('ROTA 10'));
