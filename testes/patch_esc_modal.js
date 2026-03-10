const fs = require('fs');
const file = 'js/app/feed_view.js';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
        const modalEl = document.getElementById('feed-image-modal');
        const imgEl = document.getElementById('feed-modal-image');

        if (imgEl) {
            imgEl.src = '';
            imgEl.src = originalUrl;
        }

        modalEl.classList.remove('hidden');
        modalEl.classList.add('flex');
        document.body.style.overflow = 'hidden';

        // Add Escape key listener
        const escHandler = function(e) {
            if (e.key === 'Escape') {
                closeImageModal();
            }
        };
        document.addEventListener('keydown', escHandler);
        modalEl._escHandler = escHandler;
    }

    function closeImageModal() {
        const modal = document.getElementById('feed-image-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');

            const imgEl = document.getElementById('feed-modal-image');
            if (imgEl) {
                imgEl.src = '';
            }
            document.body.style.overflow = '';

            // Remove Escape key listener
            if (modal._escHandler) {
                document.removeEventListener('keydown', modal._escHandler);
                delete modal._escHandler;
            }
        }
    }`;

content = content.replace(/        const modalEl = document.getElementById\('feed-image-modal'\);\s+const imgEl = document.getElementById\('feed-modal-image'\);\s+if \(imgEl\) \{\s+imgEl.src = '';\s+imgEl.src = originalUrl;\s+\}\s+modalEl.classList.remove\('hidden'\);\s+modalEl.classList.add\('flex'\);\s+document.body.style.overflow = 'hidden';\s+\}\s+function closeImageModal\(\) \{\s+const modal = document.getElementById\('feed-image-modal'\);\s+if \(modal\) \{\s+modal.classList.add\('hidden'\);\s+modal.classList.remove\('flex'\);\s+const imgEl = document.getElementById\('feed-modal-image'\);\s+if \(imgEl\) \{\s+imgEl.src = '';\s+\}\s+document.body.style.overflow = '';\s+\}\s+\}/, replacement);

fs.writeFileSync(file, content);
console.log('Patch applied.');
