with open("index.html", "r") as f:
    lines = f.readlines()

out = []
in_conflict = False
skip_origin = False
for line in lines:
    if line.startswith("<<<<<<< HEAD"):
        in_conflict = True
        skip_origin = False
        continue
    if line.startswith("======="):
        skip_origin = True
        continue
    if line.startswith(">>>>>>> origin/main"):
        in_conflict = False
        skip_origin = False
        continue

    if not in_conflict:
        out.append(line)
    elif in_conflict and not skip_origin:
        # Keep our head changes? No, it looks like origin/main correctly removed the duplicate FAB.
        # But wait, my head adds aria-label to the duplicated FAB. If it's deleted, we don't need it.
        # Let's verify by just dropping HEAD's duplicate FAB, since origin/main deleted it
        pass

with open("index.html", "w") as f:
    f.writelines(out)
