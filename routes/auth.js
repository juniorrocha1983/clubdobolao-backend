const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();
const nodemailer = require("nodemailer");
const crypto = require("crypto");

// ======================================================
// 🔎 VALIDAR E-MAIL
// ======================================================
function validarEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ======================================================
// 🧩 REGISTRO DE USUÁRIO
// ======================================================
router.post('/register', async (req, res) => {
    try {
        const nomeCompleto = req.body.nomeCompleto || req.body.nome;
        const apelido = req.body.apelido;
        const email = req.body.email;
        const senha = req.body.password;
        const confirmarSenha = req.body.confirmarSenha;
        const timeCoracao = req.body.time;

        if (!nomeCompleto || !apelido || !email || !senha || !timeCoracao) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }

        if (!validarEmail(email)) {
            return res.status(400).json({ error: 'E-mail inválido.' });
        }

        if (confirmarSenha && senha !== confirmarSenha) {
            return res.status(400).json({ error: 'Senhas não coincidem' });
        }

        const usuarioExistente = await User.findOne({
            $or: [{ email: email.toLowerCase().trim() }, { apelido }]
        });

        if (usuarioExistente) {
            return res.status(400).json({ error: 'Email ou apelido já cadastrado' });
        }

        const senhaHash = await bcrypt.hash(senha, 10);

        const novoUsuario = new User({
            nomeCompleto,
            apelido,
            email: email.toLowerCase().trim(),
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
// 🔐 LOGIN
// ======================================================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        const usuario = await User.findOne({ email: email.toLowerCase().trim() });

        if (!usuario) {
            return res.status(400).json({ error: 'Credenciais inválidas' });
        }

        const senhaValida = await bcrypt.compare(password, usuario.senha);

        if (!senhaValida) {
            return res.status(400).json({ error: 'Credenciais inválidas' });
        }

        const token = jwt.sign(
            { userId: usuario._id },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '7d' }
        );

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
        res.status(500).json({ error: 'Erro no login' });
    }
});

// ======================================================
// 🧾 VERIFICAR TOKEN
// ======================================================
router.get('/me', async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Token não fornecido' });

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'fallback_secret'
        );

        const user = await User.findById(decoded.userId).select('-senha');

        if (!user) {
            return res.status(401).json({ error: 'Usuário não encontrado' });
        }

        res.json({ user });

    } catch (error) {
        console.error('❌ Token inválido:', error);
        res.status(401).json({ error: 'Token inválido' });
    }
});

// ======================================================
// 🔒 RECUPERAÇÃO DE SENHA – ENVIAR E-MAIL
// ======================================================
router.post("/esqueci-senha", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) return res.status(400).json({ message: "E-mail é obrigatório" });

        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) return res.status(400).json({ message: "E-mail não encontrado" });

        const token = crypto.randomBytes(32).toString("hex");

        user.resetToken = token;
        user.resetTokenExpira = Date.now() + 3600000;
        await user.save();

        const link = `https://clubdobolao.com.br/nova-senha.html?token=${token}`;

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        await transporter.sendMail({
            from: "Club do Bolão <no-reply@clubdobolao.com.br>",
            to: email,
            subject: "Redefinição de Senha",
            html: `
                <h2>Redefinir Senha</h2>
                <p>Clique no link abaixo:</p>
                <a href="${link}">${link}</a>
                <p>Link expira em 1 hora.</p>
            `
        });

        res.json({ message: "E-mail enviado com sucesso!" });

    } catch (error) {
        console.error("Erro ao enviar recuperação:", error);
        res.status(500).json({ message: "Erro ao enviar e-mail" });
    }
});

// ======================================================
// 🔑 REDEFINIR SENHA
// ======================================================
router.post("/resetar-senha", async (req, res) => {
    try {
        const { token, novaSenha } = req.body;

        if (!token || !novaSenha) {
            return res.status(400).json({ message: "Dados inválidos" });
        }

        const user = await User.findOne({
            resetToken: token,
            resetTokenExpira: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: "Token inválido ou expirado" });
        }

        const senhaHash = await bcrypt.hash(novaSenha, 10);

        user.senha = senhaHash;
        user.resetToken = undefined;
        user.resetTokenExpira = undefined;

        await user.save();

        res.json({ message: "Senha redefinida com sucesso!" });

    } catch (error) {
        console.error("Erro ao redefinir senha:", error);
        res.status(500).json({ message: "Erro interno" });
    }
});

module.exports = router;
