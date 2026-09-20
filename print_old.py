with open('app_old.js', 'r', encoding='utf-8') as f:
    old = f.read()

start_marker = "weedSearchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSearch(e); });"
end_marker = "if (btnClose) {\n        btnClose.addEventListener('click', deactivateWeedTool);\n    }"

start = old.find(start_marker)
end = old.find(end_marker)

print(old[start:end])
