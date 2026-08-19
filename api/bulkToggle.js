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

        const { field, value } = req.body;
        
        if (!['active', 'receiveUpdates', 'entomologiaAccess'].includes(field) || typeof value !== 'boolean') {
            return res.status(400).json({ error: 'Parâmetros inválidos.' });
        }

        // Use scan to find all user keys
        let cursor = '0';
        let userKeys = [];
        do {
            const result = await redis.scan(cursor, 'MATCH', 'user:*', 'COUNT', 100);
            cursor = result[0];
            userKeys = userKeys.concat(result[1]);
        } while (cursor !== '0');

        if (userKeys.length === 0) {
            return res.status(200).json({ success: true, message: 'Nenhum usuário encontrado para alterar.' });
        }

        // Fetch all users
        const usersDataStr = await redis.mget(...userKeys);
        
        // Update all users
        const pipeline = redis.pipeline();
        usersDataStr.forEach((dataStr, index) => {
            if (dataStr) {
                let userData = JSON.parse(dataStr);
                
                // Optional: Prevent blocking the admin itself
                if (field === 'active' && !value && userData.name === 'admin_agrogis') {
                    // Do not block the admin
                    return; 
                }

                userData[field] = value;
                pipeline.set(userKeys[index], JSON.stringify(userData));
            }
        });
        
        await pipeline.exec();

        return res.status(200).json({ success: true, message: `Todos os usuários foram atualizados com sucesso.` });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Erro interno ao alterar status em massa.' });
    }
}
