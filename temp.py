with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()
    idx = text.find('const mapLayer = L.geoJSON(data, {')
    idx_end = text.find('// Add to map by default only if it\'s Fazenda or Talhao', idx)
    with open('mapLayer_block.txt', 'w', encoding='utf-8') as out:
        out.write(text[idx:idx_end])
