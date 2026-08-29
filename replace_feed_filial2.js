const fs = require('fs');
const content = fs.readFileSync('js/app/feed_view.js', 'utf8');

const regex = /(const filialRadios = document\.querySelectorAll\('input\[name="feed-filial"\]'\);[\s\S]*?if\(!e\.target\.closest\('#feed-promotor-filter-dropdown'\) && !e\.target\.closest\('#feed-promotor-filter-btn'\)\) \{\s*document\.getElementById\('feed-promotor-filter-dropdown'\)\?\.classList\.add\('hidden'\);\s*\}\s*\}\);)/;

const replacement = `if (typeof window.setupGenericFilialFilterHandlers === 'function') {
            window.setupGenericFilialFilterHandlers('feed', (val, label) => {
                feedCurrentFilialFilter = val;
                checkClearBtn();
                loadFeed(true);
            }, () => {
                document.getElementById('feed-promotor-filter-dropdown')?.classList.add('hidden');
            });
        }

        // Setup drop promotor toggle (standalone, since it's not a standard single dropdown yet)
        const promBtn = document.getElementById('feed-promotor-filter-btn');
        if (promBtn) {
            promBtn.onclick = (e) => {
                e.stopPropagation();
                document.getElementById('feed-promotor-filter-dropdown')?.classList.toggle('hidden');
                document.getElementById('feed-filial-filter-dropdown')?.classList.add('hidden');
            };
        }

        document.addEventListener('click', (e) => {
            if(!e.target.closest('#feed-promotor-filter-dropdown') && !e.target.closest('#feed-promotor-filter-btn')) {
                document.getElementById('feed-promotor-filter-dropdown')?.classList.add('hidden');
            }
        });`;

if (regex.test(content)) {
    const newContent = content.replace(regex, replacement);
    fs.writeFileSync('js/app/feed_view.js', newContent);
    console.log("Successfully replaced in feed_view.js");
} else {
    console.log("Did not find regex match");
}
