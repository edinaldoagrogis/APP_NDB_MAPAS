import json
with open('layers_data.js', 'r', encoding='utf-8') as f:
    text = f.read()
    # It starts with 'const GEOPORTAL_LAYERS = ' and ends with ';'
    start = text.find('{')
    end = text.find('};\nconst EQUIPES_DATA') + 1
    if end == 0: end = text.rfind(';')
    try:
        data = json.loads(text[start:end])
        for k in data.keys():
            val_str = json.dumps(data[k])
            print(k, len(val_str), 'bytes')
    except Exception as e:
        print('Error:', e)
