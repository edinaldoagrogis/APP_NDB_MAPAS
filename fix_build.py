with open('build_layers_optimized.py', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('import json\n            import tempfile', 'import tempfile')

with open('build_layers_optimized.py', 'w', encoding='utf-8') as out:
    out.write(text)
