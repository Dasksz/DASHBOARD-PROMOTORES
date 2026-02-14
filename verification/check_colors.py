
def check_app_js():
    with open('app.js', 'r') as f:
        content = f.read()

    required_strings = [
        'from-orange-500',
        'to-orange-600',
        'bg-orange-600',
        'fill-orange-400',
        'text-orange-500',
        'rgba(249,115,22,0.3)'
    ]

    missing = []
    for s in required_strings:
        if s not in content:
            missing.append(s)

    if missing:
        print(f"FAILED: Missing strings in app.js: {missing}")
        exit(1)
    else:
        print("SUCCESS: All new orange tone classes found.")

if __name__ == "__main__":
    check_app_js()
