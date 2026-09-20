with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = re.finditer(r"showAutocomplete\s*=\s*(function|\()", text, flags=re.DOTALL)
for m in matches:
    print(text[m.start():m.start()+1500])

if not list(matches):
    print("Not found by assignment, trying function name:")
    matches2 = re.finditer(r"function\s+showAutocomplete", text)
    for m in matches2:
        print(text[m.start():m.start()+1500])
