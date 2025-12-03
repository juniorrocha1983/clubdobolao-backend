const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();
const nodemailer = require("nodemailer");

// ======================================================
// 🧩 REGISTRO DE USUÁRIO
// ======================================================
router.post('/register', async (req, res) => {
    try {
        console.log('📥 Dados recebidos no register:', req.body);

        const nomeCompleto = req.body.nomeCompleto || req.body.nome;
        const apelido = req.body.apelido;
        const email = req.body.email;
        const senha = req.body.password;
        const confirmarSenha = req.body.confirmarSenha;
        const timeCoracao = req.body.time;

        if (!nomeCompleto || !apelido || !email || !senha || !timeCoracao) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }

        if (confirmarSenha && senha !== confirmarSenha) {
            return res.status(400).json({ error: 'Senhas não coincidem' });
        }

        const usuarioExistente = await User.findOne({
            $or: [{ email }, { apelido }]
        });

        if (usuarioExistente) {
            return res.status(400).json({ error: 'Email ou apelido já cadastrado' });
        }

        const senhaHash = await bcrypt.hash(senha, 10);

        const novoUsuario = new User({
            nomeCompleto,
            apelido,
            email,
            senha: senhaHash,
            timeCoracao
        });

        await novoUsuario.save();

        const token = jwt.sign(
            { userId: novoUsuario._id },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Usuário criado com sucesso!',
            token,
            user: {
                id: novoUsuario._id,
                nomeCompleto: novoUsuario.nomeCompleto,
                apelido: novoUsuario.apelido,
                email: novoUsuario.email,
                timeCoracao: novoUsuario.timeCoracao,
                isAdmin: novoUsuario.isAdmin
            }
        });

    } catch (error) {
        console.error('❌ ERRO NO REGISTRO:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});


// ======================================================
// 🔐 LOGIN DO USUÁRIO (CORRIGIDO E COMPATÍVEL COM SEU BANCO)
// ======================================================



router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('🔐 Dados recebidos no login:', req.body);

        if (!email || !password) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        const usuario = await User.findOne({ email });
        if (!usuario) {
            return res.status(400).json({ error: 'Credenciais inválidas (usuário não encontrado)' });
        }

        // ✅ COMPARA O HASH CORRETAMENTE (usa bcrypt se for hash, ou comparação direta se texto puro)
        const senhaHash = usuario.senha;
        let senhaValida = false;

        if (senhaHash && senhaHash.startsWith('$2')) {
            senhaValida = await bcrypt.compare(password, senhaHash);
        } else {
            senhaValida = password === senhaHash;
        }

        console.log('🔑 Senha válida?', senhaValida);

        if (!senhaValida) {
            return res.status(400).json({ error: 'Credenciais inválidas (senha incorreta)' });
        }

        const token = jwt.sign(
            { userId: usuario._id },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '7d' }
        );

        console.log('✅ Login bem-sucedido para:', usuario.email);

        res.json({
            message: 'Login realizado com sucesso',
            token,
            user: {
                id: usuario._id,
                nomeCompleto: usuario.nomeCompleto,
                apelido: usuario.apelido,
                email: usuario.email,
                timeCoracao: usuario.timeCoracao,
                isAdmin: usuario.isAdmin
            }
        });

    } catch (error) {
        console.error('❌ ERRO NO LOGIN:', error);
        res.status(500).json({ error: 'Erro no login', detalhes: error.message });
    }
});



// ======================================================
// 🧾 VERIFICAR TOKEN
// ======================================================
router.get('/me', async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Token não fornecido' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        const user = await User.findById(decoded.userId).select('-senha');

        if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });

        res.json({ user });
    } catch (error) {
        console.error('❌ Erro ao verificar token:', error);
        res.status(401).json({ error: 'Token inválido' });
    }
});

module.exports = router;
