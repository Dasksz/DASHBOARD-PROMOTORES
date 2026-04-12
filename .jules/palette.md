## 2024-04-10 - Aria-labels added via sed
**Learning:** Found an extensive pattern of icon-only SVG buttons lacking descriptive aria-labels for proper accessibility tracking across the entire HTML and JS template strings. Applied massive search and replace with descriptive Portuguese aria labels to meet accessibility requirements.
**Action:** Always ensure any newly added icon-based buttons or input files correctly supply descriptive `aria-label` tags in Portuguese from the beginning to avoid large-scale manual sweeps later.

## 2024-04-11 - Aria-labels added to pagination buttons
**Learning:** Found a pattern of pagination buttons across the application containing abbreviated text ("Ant", "Prox") or simple Portuguese text ("Anterior", "Próxima") but lacking screen-reader specific aria-labels. Applied massive search and replace with descriptive Portuguese aria labels (Página Anterior, Próxima Página) to meet accessibility requirements.
**Action:** Always ensure any newly added pagination buttons correctly supply descriptive `aria-label` tags in Portuguese.
