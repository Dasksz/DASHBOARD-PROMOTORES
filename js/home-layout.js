// Native disclosures keep the selected filters and remain open while the user works.
document.querySelectorAll('#main-dashboard .dashboard-disclosure').forEach(section => {
    section.addEventListener('toggle', () => {
        if (!section.open) return;
        requestAnimationFrame(() => {
            for (const root of window.am5?.registry?.rootElements || []) {
                if (root.dom && section.contains(root.dom)) root.resize();
            }
        });
    });
});
