const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL;
let redis;
if (redisUrl) {
    redis = new Redis(redisUrl);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    
    try {
        if (!redis) {
            return res.status(500).json({ error: 'Banco de dados não configurado (REDIS_URL missing)' });
        }

        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Usuário ou senha em branco' });
        }
        
        const passLower = password.toLowerCase();
        if (passLower !== 'ndb_mapas' && passLower !== 'ndb_mapa') {
            return res.status(401).json({ error: 'Senha incorreta' });
        }
        
        // Clean username: remove spaces, lowercase
        const cleanUser = username.trim().replace(/\s+/g, '').toLowerCase();
        
        if (!cleanUser) {
            return res.status(400).json({ error: 'Usuário inválido' });
        }

        // Allow emergency admin access unconditionally just in case DB is down or locked
        if (cleanUser === 'admin_agrogis' && password === 'ndb_mapas') {
             return res.status(200).json({ success: true, user: 'admin_agrogis' });
        }
        
        // Fetch user from Redis
        const userKey = `user:${cleanUser}`;
        let userDataStr = await redis.get(userKey);
        
        let userData;
        if (!userDataStr) {
            // Auto register as ACTIVE on first login
            userData = {
                name: cleanUser,
                active: true,
                createdAt: Date.now()
            };
            await redis.set(userKey, JSON.stringify(userData));
        } else {
            userData = JSON.parse(userDataStr);
        }
        
        // Check if blocked
        if (userData.active === false) {
            return res.status(403).json({ error: 'Seu acesso foi bloqueado pelo administrador.' });
        }
        
        // Allowed
        return res.status(200).json({ success: true, user: userData.name });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Erro interno no servidor de login.' });
    }
}
