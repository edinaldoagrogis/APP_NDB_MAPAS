with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()
import re
matches = re.finditer(r"searchInput\.addEventListener\('input'.*?\}\);", text, flags=re.DOTALL)
for m in matches:
    print(m.group(0)[:1500])
