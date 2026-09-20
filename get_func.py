with open('car/car.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

in_func = False
braces = 0
for line in lines:
    if 'function setupFazendaSearch' in line:
        in_func = True
    if in_func:
        print(line, end='')
        braces += line.count('{')
        braces -= line.count('}')
        if braces == 0 and '{' in line:
            break
