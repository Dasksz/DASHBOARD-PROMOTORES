import re

with open('js/app/app.js', 'r') as f:
    content = f.read()

# Titulos rede filter refactoring
titulos_pattern = r"""            const redeGroupContainer = document\.getElementById\('titulos-rede-group-container'\);\s+const comRedeBtn = document\.getElementById\('titulos-com-rede-btn'\);\s+const comRedeBtnText = document\.getElementById\('titulos-com-rede-btn-text'\);\s+const redeDropdown = document\.getElementById\('titulos-rede-filter-dropdown'\);\s+if \(redeGroupContainer && !redeGroupContainer\._hasListener\) \{\s+redeGroupContainer\.addEventListener\('click', \(e\) => \{\s+const btn = e\.target\.closest\('button'\);\s+if \(!btn\) return;\s+const group = btn\.dataset\.group;\s+titulosRedeGroupFilter = group;\s+redeGroupContainer\.querySelectorAll\('button'\)\.forEach\(b => b\.classList\.remove\('active'\)\);\s+btn\.classList\.add\('active'\);\s+if \(group === 'com_rede'\) redeDropdown\.classList\.remove\('hidden'\);\s+else redeDropdown\.classList\.add\('hidden'\);\s+handleTitulosFilterChange\(\);\s+\}\);\s+redeGroupContainer\._hasListener = true;\s+\}\s+if \(redeDropdown && !redeDropdown\._hasListener\) \{\s+redeDropdown\.addEventListener\('change', \(\) => handleTitulosFilterChange\(\)\);\s+redeDropdown\._hasListener = true;\s+\}"""

titulos_replace = """            if (typeof window.setupGenericRedeFilterHandlers === 'function') {
                window.setupGenericRedeFilterHandlers('titulos',
                    { get groupFilter() { return titulosRedeGroupFilter; }, set groupFilter(v) { titulosRedeGroupFilter = v; },
                      get selectedRedes() { return selectedTitulosRedes; }, set selectedRedes(v) { selectedTitulosRedes = v; } },
                    () => {
                        let clients = [];
                        if (typeof getHierarchyFilteredClients === 'function') {
                            clients = getHierarchyFilteredClients('titulos', { excludeFilter: 'rede' });
                        }
                        return clients;
                    },
                    handleTitulosFilterChange,
                    updateTitulosRedeFilter
                );
            }"""

if re.search(titulos_pattern, content):
    content = re.sub(titulos_pattern, titulos_replace, content)
    print("Found and replaced titulos rede filter")
else:
    print("Could not find titulos rede filter")


# LP rede filter refactoring
lp_pattern = r"""        const redeGroupContainer = document\.getElementById\('lp-rede-group-container'\);\s+const comRedeBtn = document\.getElementById\('lp-com-rede-btn'\);\s+const comRedeBtnText = document\.getElementById\('lp-com-rede-btn-text'\);\s+const redeDropdown = document\.getElementById\('lp-rede-filter-dropdown'\);\s+if \(redeGroupContainer && !redeGroupContainer\._hasListener\) \{\s+redeGroupContainer\.addEventListener\('click', \(e\) => \{\s+const btn = e\.target\.closest\('button'\);\s+if \(!btn\) return;\s+const group = btn\.dataset\.group;\s+lpRedeGroupFilter = group;\s+redeGroupContainer\.querySelectorAll\('button'\)\.forEach\(b => b\.classList\.remove\('active'\)\);\s+btn\.classList\.add\('active'\);\s+if \(group === 'com_rede'\) redeDropdown\.classList\.remove\('hidden'\);\s+else redeDropdown\.classList\.add\('hidden'\);\s+handleLpFilterChange\(\);\s+\}\);\s+redeGroupContainer\._hasListener = true;\s+\}\s+if \(redeDropdown && !redeDropdown\._hasListener\) \{\s+redeDropdown\.addEventListener\('change', \(\) => handleLpFilterChange\(\)\);\s+redeDropdown\._hasListener = true;\s+\}"""

lp_replace = """        if (typeof window.setupGenericRedeFilterHandlers === 'function') {
            window.setupGenericRedeFilterHandlers('lp',
                { get groupFilter() { return lpRedeGroupFilter; }, set groupFilter(v) { lpRedeGroupFilter = v; },
                  get selectedRedes() { return selectedLpRedes; }, set selectedRedes(v) { selectedLpRedes = v; } },
                () => {
                    let clients = [];
                    if (typeof getHierarchyFilteredClients === 'function') {
                        clients = getHierarchyFilteredClients('lp', { excludeFilter: 'rede' });
                    }
                    return clients;
                },
                () => handleLpFilterChange(),
                updateLpRedeFilter
            );
        }"""

if re.search(lp_pattern, content):
    content = re.sub(lp_pattern, lp_replace, content)
    print("Found and replaced lp rede filter")
else:
    print("Could not find lp rede filter")

with open('js/app/app.js', 'w') as f:
    f.write(content)
