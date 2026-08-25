export default async function handler(req, res) {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }
    
    try {
        // Vercel serverless env provides global fetch
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });
        const data = await response.text();
        
        res.setHeader('Content-Type', response.headers.get('content-type') || 'application/xml');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(response.status).send(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
