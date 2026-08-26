with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('const html = \<div', 'const html = <div')
text = text.replace('</div>\;', '</div>;')

with open('app.js', 'w', encoding='utf-8') as out:
    out.write(text)
