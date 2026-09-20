with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()
import re
matches = re.finditer(r"function handleSearch", text)
for m in matches:
    print(text[m.start():m.start()+2000])
    print('---')
