with open('app_old_2.js', 'r', encoding='utf-16') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if "weedSearchInput.addEventListener('keydown'" in line:
        for j in range(i-10, i):
            print(lines[j], end='')
        break
