const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL;
let redis;
if (redisUrl) {
    redis = new Redis(redisUrl);
}

const ADMIN_PASSWORD = 'admin_agrogis';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    
    try {
        if (!redis) return res.status(500).json({ error: 'Banco de dados não configurado (REDIS_URL missing)' });
        
        // Basic auth check
        const auth = req.headers.authorization;
        if (auth !== `Bearer ${ADMIN_PASSWORD}`) {
            return res.status(401).json({ error: 'Acesso negado ao portal administrativo.' });
        }

        const { username, entomologiaAccess } = req.body;
        
        if (!username || typeof entomologiaAccess !== 'boolean') {
            return res.status(400).json({ error: 'Parâmetros inválidos.' });
        }

        const cleanUser = username.trim().toLowerCase();
        const userKey = `user:${cleanUser}`;
        
        let userDataStr = await redis.get(userKey);
        
        if (!userDataStr) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        
        let userData = JSON.parse(userDataStr);
        userData.entomologiaAccess = entomologiaAccess;
        
        await redis.set(userKey, JSON.stringify(userData));

        return res.status(200).json({ success: true, message: `Status de Entomologia de ${userData.name} alterado com sucesso.` });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Erro interno ao alterar status do usuário.' });
    }
}
