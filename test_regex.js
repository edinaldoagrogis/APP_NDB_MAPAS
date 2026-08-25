const fs = require('fs');
const xmlText = fs.readFileSync('test_incra.xml', 'utf-8');

const coordsMatch = xmlText.match(/<gml:coordinates>([\s\S]*?)<\/gml:coordinates>/);
if (coordsMatch) {
    console.log('Coordinates matched!');
} else {
    console.log('Coordinates NOT matched!');
}

const properties = {};
const propMatches = xmlText.matchAll(/<ms:([^>]+)>([\s\S]*?)<\/ms:\1>/g);
for (const match of propMatches) {
    if (match[1] !== 'msGeometry') {
        properties[match[1]] = match[2].trim();
    }
}
console.log('Properties:', properties);
