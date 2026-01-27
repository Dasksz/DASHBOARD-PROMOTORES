
import os

def check_file(filepath, search_str):
    with open(filepath, 'r') as f:
        content = f.read()
        if search_str in content:
            print(f"PASS: Found '{search_str}' in {filepath}")
        else:
            print(f"FAIL: Did NOT find '{search_str}' in {filepath}")

check_file('init.js', "const DB_NAME = 'PrimeDashboardDB_V2'")
check_file('worker.js', "'PEDIDO': 'string'")
