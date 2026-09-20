with open('app.js', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("if (!drawActive || drawMode !== 'area' || currentPolygonPoints.length === 0) return;",
              "if (!drawActive || drawMode !== 'area' || currentPolygonPoints.length === 0 || window.isMeasureDragging) return;")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(c)
print('Fixed area mousemove!')
