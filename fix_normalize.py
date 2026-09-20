import re
with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

def repl(m):
    return "const normalize = (str) => String(str || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();"

text = re.sub(r'const normalize = \(str\) => String.*?toLowerCase\(\)\.trim\(\);', repl, text)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)
print('Replaced all normalizes!')
