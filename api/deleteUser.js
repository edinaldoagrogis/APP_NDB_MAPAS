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

        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ error: 'Nome de usuário inválido.' });
        }

        const cleanUser = username.trim().toLowerCase();
        
        if (cleanUser === 'admin_agrogis') {
            return res.status(403).json({ error: 'Não é possível excluir o usuário administrador.' });
        }

        const userKey = `user:${cleanUser}`;
        
        const deleted = await redis.del(userKey);
        
        if (deleted === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        return res.status(200).json({ success: true, message: `Usuário ${username} foi excluído com sucesso.` });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Erro interno ao tentar excluir usuário.' });
    }
}
