// pathfinder.js - Simple offline GeoJSON router
class GeoJSONPathFinder {
    constructor(geojson) {
        this.graph = new Map();
        this.buildGraph(geojson);
    }

    roundCoord(c) {
        return c.toFixed(5);
    }

    makeNode(lon, lat) {
        return this.roundCoord(lon) + ',' + this.roundCoord(lat);
    }

    distance(lon1, lat1, lon2, lat2) {
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    buildGraph(geojson) {
        const addEdge = (node1, node2, dist, c1, c2) => {
            if (!this.graph.has(node1)) this.graph.set(node1, []);
            if (!this.graph.has(node2)) this.graph.set(node2, []);
            this.graph.get(node1).push({ target: node2, dist: dist, coords: c2 });
            this.graph.get(node2).push({ target: node1, dist: dist, coords: c1 });
        };

        geojson.features.forEach(feat => {
            if (feat.geometry.type === 'LineString') {
                this.processLine(feat.geometry.coordinates, addEdge);
            } else if (feat.geometry.type === 'MultiLineString') {
                feat.geometry.coordinates.forEach(line => this.processLine(line, addEdge));
            }
        });
    }

    processLine(coords, addEdge) {
        for (let i = 0; i < coords.length - 1; i++) {
            const c1 = coords[i];
            const c2 = coords[i+1];
            const n1 = this.makeNode(c1[0], c1[1]);
            const n2 = this.makeNode(c2[0], c2[1]);
            if (n1 !== n2) {
                const dist = this.distance(c1[0], c1[1], c2[0], c2[1]);
                addEdge(n1, n2, dist, c1, c2);
            }
        }
    }

    findNearestNode(lon, lat) {
        let minDist = Infinity;
        let nearest = null;
        let coords = null;
        for (let [node, edges] of this.graph.entries()) {
            if (edges.length > 0) {
                const c = edges[0].coords;
                // fallback to edge targets if c1/c2 parsing needed, but edges[0] is fine
                const d = this.distance(lon, lat, c[0], c[1]);
                if (d < minDist) {
                    minDist = d;
                    nearest = node;
                    coords = c;
                }
            }
        }
        return { node: nearest, dist: minDist, coords: coords };
    }

    findPath(startLon, startLat, endLon, endLat) {
        const start = this.findNearestNode(startLon, startLat);
        const end = this.findNearestNode(endLon, endLat);

        if (!start.node || !end.node) return null;

        const distances = new Map();
        const previous = new Map();
        const coordsMap = new Map();
        const visited = new Set();
        const pq = new MinPriorityQueue();

        distances.set(start.node, 0);
        coordsMap.set(start.node, start.coords);
        pq.enqueue(start.node, 0);

        let visitedCount = 0;

        while (!pq.isEmpty()) {
            const current = pq.dequeue();
            
            if (visited.has(current)) continue;
            visited.add(current);
            visitedCount++;

            if (visitedCount > 50000) {
                // Safeguard para não travar o navegador se a rota for impossível/muito longa
                return null; 
            }

            if (current === end.node) {
                const path = [];
                let curr = current;
                while (curr) {
                    path.unshift(coordsMap.get(curr));
                    curr = previous.get(curr);
                }
                // Removemos o unshift(startLon, startLat) e push(endLon, endLat) 
                // para que a rota só passe pelas feições mapeadas e não crie retas falsas.
                return path;
            }

            const edges = this.graph.get(current) || [];
            for (let edge of edges) {
                if (visited.has(edge.target)) continue;
                
                const alt = distances.get(current) + edge.dist;
                if (alt < (distances.get(edge.target) || Infinity)) {
                    distances.set(edge.target, alt);
                    previous.set(edge.target, current);
                    coordsMap.set(edge.target, edge.coords);
                    pq.enqueue(edge.target, alt);
                }
            }
        }
        return null;
    }
}

// Binary Heap Min Priority Queue for fast Dijkstra
class MinPriorityQueue {
    constructor() {
        this.values = [];
    }
    enqueue(element, priority) {
        this.values.push({element, priority});
        this.bubbleUp();
    }
    bubbleUp() {
        let idx = this.values.length - 1;
        const element = this.values[idx];
        while (idx > 0) {
            let parentIdx = Math.floor((idx - 1) / 2);
            let parent = this.values[parentIdx];
            if (element.priority >= parent.priority) break;
            this.values[parentIdx] = element;
            this.values[idx] = parent;
            idx = parentIdx;
        }
    }
    dequeue() {
        if (this.values.length === 0) return null;
        const min = this.values[0];
        const end = this.values.pop();
        if (this.values.length > 0) {
            this.values[0] = end;
            this.sinkDown();
        }
        return min.element;
    }
    sinkDown() {
        let idx = 0;
        const length = this.values.length;
        const element = this.values[0];
        while (true) {
            let leftChildIdx = 2 * idx + 1;
            let rightChildIdx = 2 * idx + 2;
            let leftChild, rightChild;
            let swap = null;

            if (leftChildIdx < length) {
                leftChild = this.values[leftChildIdx];
                if (leftChild.priority < element.priority) {
                    swap = leftChildIdx;
                }
            }
            if (rightChildIdx < length) {
                rightChild = this.values[rightChildIdx];
                if ((swap === null && rightChild.priority < element.priority) ||
                    (swap !== null && rightChild.priority < leftChild.priority)) {
                    swap = rightChildIdx;
                }
            }
            if (swap === null) break;
            this.values[idx] = this.values[swap];
            this.values[swap] = element;
            idx = swap;
        }
    }
    isEmpty() {
        return this.values.length === 0;
    }
}

window.GeoJSONPathFinder = GeoJSONPathFinder;
