const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL;
let redis;
if (redisUrl) {
    redis = new Redis(redisUrl);
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    
    try {
        if (!redis) return res.status(500).json({ error: 'Banco de dados não configurado (REDIS_URL missing)' });
        
        const { points, user } = req.body;
        
        if (!points || !Array.isArray(points) || points.length === 0) {
            return res.status(400).json({ error: 'Nenhum ponto recebido.' });
        }

        const timestamp = Date.now();
        const syncId = \sync:entomologia:\\;
        
        const payload = {
            user: user || 'Desconhecido',
            timestamp,
            points
        };

        // Salva os pontos na nuvem com expiração de 24 horas (caso o portal não colete)
        await redis.set(syncId, JSON.stringify(payload), 'EX', 86400);

        return res.status(200).json({ success: true, message: \Sincronizados \ pontos com sucesso!\ });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Erro interno ao sincronizar os dados.' });
    }
}
