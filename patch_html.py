with open('index.html', 'r') as f:
    html = f.read()

# Add a "Limpar Filtro" button next to the "Favoritos" button
target = '''<button id="feed-favorites-btn" class="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-yellow-400 font-medium rounded-lg border border-slate-700 transition-colors shadow-sm">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                        Favoritos
                    </button>'''

replacement = target + '''
                    <button id="feed-clear-favorites-btn" class="hidden w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2.5 bg-brand-orange/10 hover:bg-brand-orange/20 text-brand-orange font-medium rounded-lg border border-brand-orange/30 transition-colors shadow-sm">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        Limpar Filtro
                    </button>'''

html = html.replace(target, replacement)

with open('index.html', 'w') as f:
    f.write(html)

print("HTML Patched.")
