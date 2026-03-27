const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Aposta = require('../models/Aposta');
const Rodada = require('../models/Rodada');
const { auth, protect, adminOnly } = require('../middleware/auth');


// ======================================================
// 🔍 RETORNA OS DADOS DO USUÁRIO LOGADO
// ======================================================
router.get("/me", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-senha");

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        res.json(user);

    } catch (err) {
        console.error("❌ Erro ao carregar usuário:", err);
        res.status(500).json({ error: "Erro ao carregar dados do usuário" });
    }
});




// 🎯 GET /api/usuario/dados - Dados básicos do usuário
/*router.get('/dados', auth, async (req, res) => {
    try {
        const usuario = await User.findById(req.user.id).select('-senha');

        if (!usuario) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        res.json({
            _id: usuario._id,
            apelido: usuario.apelido,
            email: usuario.email,
            timeCoracao: usuario.timeCoracao,
            dataCadastro: usuario.dataCadastro,
            estatisticas: await gerarEstatisticasUsuario(req.user.id)
        });
    } catch (error) {
        console.error('❌ Erro ao buscar dados do usuário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});*/

// 🎯 GET /api/usuario/estatisticas - Estatísticas detalhadas
router.get('/estatisticas', auth, async (req, res) => {
    try {
        const estatisticas = await gerarEstatisticasUsuario(req.user.id);
        res.json(estatisticas);
    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});


// 🛠️ PUT /api/usuario/update - Atualiza dados do usuário logado
router.put('/update', auth, async (req, res) => {
    try {
        const { apelido, timeCoracao, notificacoes, senha } = req.body;
        const usuario = await User.findById(req.user.id);

        if (!usuario) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        // ⚙️ Atualiza apenas campos permitidos
        if (apelido && apelido !== usuario.apelido) usuario.apelido = apelido;
        if (timeCoracao) usuario.timeCoracao = timeCoracao;
        if (typeof notificacoes === 'boolean') usuario.notificacoes = notificacoes;

        // 🔒 Atualiza senha se o usuário quiser trocar
        if (senha && senha.trim() !== '') {
            const bcrypt = require('bcryptjs');
            const salt = await bcrypt.genSalt(10);
            usuario.senha = await bcrypt.hash(senha, salt);
        }

        await usuario.save();

        // 🧠 Retorna dados atualizados
        res.json({
            _id: usuario._id,
            nomeCompleto: usuario.nomeCompleto, // 👈 ADICIONA ISSO
            apelido: usuario.apelido,
            email: usuario.email,
            timeCoracao: usuario.timeCoracao,
            dataCadastro: usuario.dataCadastro,
            estatisticas: await gerarEstatisticasUsuario(req.user.id)
        });

    } catch (error) {
        console.error('❌ Erro ao atualizar perfil:', error);
        res.status(500).json({ message: 'Erro ao atualizar perfil.' });
    }
});

// 🎯 FUNÇÃO PARA GERAR ESTATÍSTICAS DO USUÁRIO
async function gerarEstatisticasUsuario(userId) {
    try {
        // Buscar todas as apostas do usuário
        const apostas = await Aposta.find({ usuario: userId })
            .populate('rodada')
            .sort({ dataCriacao: -1 });

        // Calcular estatísticas
        const rodadasParticipadas = new Set(apostas.map(a => a.rodada?._id?.toString())).size;

        // Pontuação (simulada - você precisa implementar a lógica real)
        let pontosTemporada = 0;
        let pontosMes = 0;
        const mesAtual = new Date().getMonth();
        const anoAtual = new Date().getFullYear();

        apostas.forEach(aposta => {
            if (aposta.status === 'paga' || aposta.status === 'brinde') {
                // Simular pontos baseados no número de linhas
                const pontosAposta = aposta.numLinhas * 2;
                pontosTemporada += pontosAposta;

                // Verificar se é do mês atual
                const dataAposta = new Date(aposta.dataCriacao);
                if (dataAposta.getMonth() === mesAtual && dataAposta.getFullYear() === anoAtual) {
                    pontosMes += pontosAposta;
                }
            }
        });

        // Buscar ranking (simulado)
        const totalUsuarios = await User.countDocuments();
        const rankingGeral = Math.max(1, Math.min(totalUsuarios, Math.floor(Math.random() * totalUsuarios) + 1));
        const rankingMes = Math.max(1, Math.min(50, Math.floor(Math.random() * 50) + 1));

        return {
            pontosMes,
            pontosTemporada,
            rankingMes: `${rankingMes}º`,
            rankingGeral: `${rankingGeral}º`,
            rodadasParticipadas,
            totalApostas: apostas.length,
            apostasAtivas: apostas.filter(a => a.status === 'paga' || a.status === 'brinde').length,
            apostasPendentes: apostas.filter(a => a.status === 'pendente').length
        };
    } catch (error) {
        console.error('❌ Erro ao gerar estatísticas:', error);
        return {
            pontosMes: 0,
            pontosTemporada: 0,
            rankingMes: '--',
            rankingGeral: '--',
            rodadasParticipadas: 0,
            totalApostas: 0,
            apostasAtivas: 0,
            apostasPendentes: 0
        };
    }
}

// 🔒 ALTERAR STATUS DO USUÁRIO (Admin)
router.put("/status/:id", protect, adminOnly, async (req, res) => {
    try {
        const usuario = await User.findById(req.params.id);
        if (!usuario) return res.status(404).json({ message: "Usuário não encontrado" });

        // alterna ativo/bloqueado
        usuario.status = usuario.status === "ativo" ? "bloqueado" : "ativo";
        await usuario.save();

        res.json({
            message: "Status atualizado com sucesso!",
            novoStatus: usuario.status
        });

    } catch (err) {
        console.error("❌ Erro ao alterar status:", err);
        res.status(500).json({ message: "Erro ao alterar status do usuário." });
    }
});

router.get("/historico/:userId", protect, adminOnly, async (req, res) => {
    try {
        const apostas = await Aposta.find({ usuario: req.params.userId })
            .populate("rodada")
            .sort({ createdAt: -1 });

        res.json(apostas);
    } catch (err) {
        res.status(500).json({ message: "Erro ao carregar histórico." });
    }
});

router.get("/premio/:userId", protect, adminOnly, async (req, res) => {
    try {
        const usuario = await User.findById(req.params.userId);
        res.json(usuario.solicitacaoPremio || null);
    } catch (err) {
        res.status(500).json({ message: "Erro ao buscar solicitação." });
    }
});

// 👑 Permite ao admin visualizar dados de outro jogador
router.get("/:id", protect, adminOnly, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select("-password");
        if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
        res.json(user);
    } catch (err) {
        console.error("❌ Erro ao buscar usuário:", err);
        res.status(500).json({ message: "Erro interno ao buscar usuário" });
    }
});
// ======================================================
// 🔐 SALVAR OU ATUALIZAR CPF DO USUÁRIO
// ======================================================
router.post("/salvar-cpf", auth, async (req, res) => {
    try {
        const { cpf } = req.body;

        if (!cpf) {
            return res.status(400).json({ error: "CPF é obrigatório." });
        }

        // Atualiza no usuário logado
        await User.findByIdAndUpdate(req.user.id, { cpf });

        res.json({ sucesso: true, mensagem: "CPF salvo com sucesso!" });

    } catch (err) {
        console.log("❌ Erro ao salvar CPF:", err);
        res.status(500).json({ error: "Erro ao salvar CPF" });
    }
});


module.exports = router;

