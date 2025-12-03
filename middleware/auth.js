// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');


// ✅ Middleware principal de autenticação (usado em quase todas as rotas)
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Token não fornecido' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        const user = await User.findById(decoded.id || decoded.userId).select('-senha -password');
        if (!user) {
            return res.status(401).json({ error: 'Usuário não encontrado' });
        }

        req.user = {
            id: user._id,
            apelido: user.apelido,
            email: user.email,
            isAdmin: user.isAdmin
        };

        next();
    } catch (error) {
        console.error('❌ Erro de autenticação:', error);
        res.status(401).json({ error: 'Token inválido ou expirado' });
    }
};



// ✅ Middleware para proteger rotas (autenticação básica)
const protect = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'Token não fornecido' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        const user = await User.findById(decoded.id || decoded.userId).select('-senha -password');
        if (!user) return res.status(401).json({ message: 'Usuário não encontrado' });

        req.user = user;
        next();
    } catch (error) {
        console.error('❌ Erro no middleware protect:', error);
        res.status(401).json({ message: 'Token inválido ou expirado' });
    }
};

// ✅ Middleware de verificação de admin
const adminOnly = (req, res, next) => {
    if (req.user && req.user.isAdmin) {
        next();
    } else {
        res.status(403).json({ message: 'Acesso negado — apenas administradores' });
    }
};

// ✅ Exportação correta (objeto com todas as funções)
module.exports = { auth, protect, adminOnly };
