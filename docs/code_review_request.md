# Request
The user pointed out that although the client names were fixed, the photos and details from the surveys (`respostas` column) were not showing up. It turns out that the `respostas` column does not always contain a nested array for photos but instead has top-level keys like `foto_url` mixed with boolean/string answers like `tem_ilha` or `estado_gondola`.

I updated `js/app/feed_view.js` to handle:
1. Identifying any key with "foto" dynamically (like `foto_url`) and rendering it as part of the photo carousel.
2. Improved the text summary by properly formatting the other keys (capitalizing letters, removing underscores, ignoring empty values, and styling "Sim"/"Não" with color coding).

Please review the parsing changes to ensure they are solid.

# Modified Files
- `js/app/feed_view.js`
