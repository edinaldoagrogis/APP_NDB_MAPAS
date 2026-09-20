with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'console.error("Erro no zoom:' in line:
        for j in range(i-2, i+10):
            if j < len(lines):
                print(f'{j+1}: {lines[j]}', end='')
