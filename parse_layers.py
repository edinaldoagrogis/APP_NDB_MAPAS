import json
with open('layers_data.js', 'r', encoding='utf-8') as f:
    text = f.read()
    # Replace 'const GEOPORTAL_LAYERS = ' with ''
    text = text.replace('const GEOPORTAL_LAYERS = ', '')
    # there might be other consts at the end
    end_idx = text.find(';\nconst EQUIPES_DATA =')
    if end_idx != -1:
        text = text[:end_idx]
    
    try:
        data = json.loads(text)
        print("Keys:", list(data.keys()))
    except Exception as e:
        print("JSON parse error:", e)
