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

    if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');
    
    try {
        if (!redis) return res.status(500).json({ error: 'Banco de dados não configurado (REDIS_URL missing)' });
        
        let cursor = '0';
        let syncKeys = [];
        do {
            const result = await redis.scan(cursor, 'MATCH', 'sync:entomologia:*', 'COUNT', 100);
            cursor = result[0];
            syncKeys = syncKeys.concat(result[1]);
        } while (cursor !== '0');

        if (syncKeys.length === 0) {
            return res.status(200).json({ success: true, data: [] });
        }

        const dataStrArray = await redis.mget(...syncKeys);
        const allSyncs = dataStrArray.map(str => JSON.parse(str));

        if (req.query.clear === 'true') {
            await redis.del(...syncKeys);
        }

        return res.status(200).json({ success: true, data: allSyncs });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Erro interno ao buscar os dados.' });
    }
}
