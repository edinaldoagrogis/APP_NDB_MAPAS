const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL;
let redis;
if (redisUrl) {
    redis = new Redis(redisUrl);
}

const ADMIN_PASSWORD = 'admin_agrogis';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');
    
    try {
        if (!redis) return res.status(500).json({ error: 'Banco de dados não configurado (REDIS_URL missing)' });
        
        // Basic auth check
        const auth = req.headers.authorization;
        if (auth !== `Bearer ${ADMIN_PASSWORD}`) {
            return res.status(401).json({ error: 'Acesso negado ao portal administrativo.' });
        }

        // Get all user keys
        let keys = await redis.keys('user:*');
        
        let users = [];
        if (keys.length > 0) {
            const usersData = await redis.mget(keys);
            users = usersData.map(data => JSON.parse(data));
        }
        
        // Sort by creation date or name
        users.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

        return res.status(200).json({ success: true, users });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Erro interno ao buscar usuários.' });
    }
}
