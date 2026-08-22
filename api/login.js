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

        const { username, password, deviceId, isBackgroundCheck } = req.body;
        
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
        let requiresSave = false;

        if (!userDataStr) {
            // Check if this is the very first user in the database
            const existingKeys = await redis.keys('user:*');
            const isFirstUser = existingKeys.length === 0;

            // Auto register as ACTIVE on first login
            userData = {
                name: cleanUser,
                active: true,
                receiveUpdates: isFirstUser, // First user gets updates by default
                createdAt: Date.now()
            };
            requiresSave = true;
        } else {
            userData = JSON.parse(userDataStr);
            // Ensure older users have the property
            if (userData.receiveUpdates === undefined) {
                userData.receiveUpdates = false;
                requiresSave = true;
            }
        }
        
        // Check if blocked
        if (userData.active === false) {
            return res.status(403).json({ error: 'Seu acesso foi bloqueado pelo administrador.' });
        }

        // Check simultaneous access
        if (deviceId) {
            if (isBackgroundCheck) {
                // Background verification: device must match the one in DB
                if (userData.currentDeviceId && userData.currentDeviceId !== deviceId) {
                    return res.status(403).json({ error: 'CONCURRENCY_ERROR', message: 'Sua conta foi conectada em outro dispositivo.' });
                }
            } else {
                // Real login: take over session
                userData.currentDeviceId = deviceId;
                requiresSave = true;
            }
        }

        if (requiresSave) {
            await redis.set(userKey, JSON.stringify(userData));
        }
        
        // Allowed
        return res.status(200).json({ 
            success: true, 
            user: userData.name,
            receiveUpdates: userData.receiveUpdates,
            entomologiaAccess: userData.entomologiaAccess || false
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Erro interno no servidor de login.' });
    }
}
