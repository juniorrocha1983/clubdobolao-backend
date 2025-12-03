const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Rodada = require('../models/Rodada');
const Aposta = require('../models/Aposta');

// 🎯 DADOS FINANCEIROS
router.get('/', auth, async (req, res) => {
    try {
        const rodada = await Rodada.findOne({ status: 'ativa' });
        if (!rodada) {
            return res.json({
                totalArrecadado: 0,
                premioRodada: 0,
                taxaBanca: 0,
                ticketMedio: 0,
                distribuicao: {}
            });
        }

        // pegar apostas da rodada
        const apostas = await Aposta.find({ rodada: rodada._id });

        // soma REAL do valor de cada aposta
        const totalArrecadado = apostas.reduce((soma, a) => soma + (a.valor || 0), 0);

        // soma total de linhas
        const totalLinhas = apostas.reduce((soma, a) => soma + (a.numLinhas || 0), 0);

        // ticket médio = linhas / apostas
        const ticketMedio = apostas.length ? (totalLinhas / apostas.length) : 0;

        // distribuição por quantidade de linhas
        const distribuicao = {};
        apostas.forEach(a => {
            const n = a.numLinhas || 0;
            distribuicao[n] = (distribuicao[n] || 0) + 1;
        });

        res.json({
            totalArrecadado,
            premioRodada: totalArrecadado * 0.9,
            taxaBanca: totalArrecadado * 0.1,
            ticketMedio,
            distribuicao
        });

    } catch (err) {
        console.error("Erro financeiro:", err);
        res.status(500).json({ error: "Erro ao obter dados financeiros" });
    }
});


module.exports = router;
