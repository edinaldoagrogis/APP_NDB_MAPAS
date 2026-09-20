import re
with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix the regex in normalize function
# Find broken regex and replace it with correct \u0300-\u036f
broken_regex = r"replace\(/\[\xef\xbf\xbd\?-\xef\xbf\xbd\]/g"
text = re.sub(broken_regex, r"replace(/[\\u0300-\\u036f]/g", text)
# Just to be safe, replace any literal broken regex
text = re.sub(r"replace\(/\[.*?-\.*?\]/g,\s*''\)\.toLowerCase", r"replace(/[\\u0300-\\u036f]/g, '').toLowerCase", text)

# Fix zoom in handleSearch (both of them)
text = text.replace("maxZoom: 16", "maxZoom: 14")
text = text.replace("map.flyTo(bestMatches[0].getLatLng(), 16", "map.flyTo(bestMatches[0].getLatLng(), 14")
text = text.replace("map.flyTo(finalFoundLayer.getLatLng(), 16", "map.flyTo(finalFoundLayer.getLatLng(), 14")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)
print('Fixed!')
