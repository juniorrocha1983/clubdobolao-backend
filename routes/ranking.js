// routes/ranking.js
const express = require('express');
const router = express.Router();
const RankingRodada = require('../models/RankingRodada');
const RankingTorcida = require('../models/RankingTorcida');
const RankingGeral = require('../models/RankingGeral');





// ============================================================
// 🏁 RANKING DA ÚLTIMA RODADA FINALIZADA
// ============================================================
router.get('/rodada/ultima', async (req, res) => {
  try {
    const ultima = await RankingRodada.findOne().sort({ atualizadoEm: -1 }).lean();

    if (!ultima) {
      return res.status(404).json({ message: 'Nenhum ranking encontrado' });
    }

    res.json({
      rodada: {
        nome: ultima.rodadaNome || 'Rodada desconhecida',
        numero: ultima.numero || 0,
        status: ultima.status || 'indefinido',
        participantes: ultima.participantes || 0,
        atualizadoEm: ultima.atualizadoEm,
      },
      ranking: ultima.ranking || [],
    });
  } catch (error) {
    console.error('❌ Erro ao buscar último ranking:', error);
    res.status(500).json({ error: 'Erro ao buscar último ranking', detalhes: error.message });
  }
});



// ============================================================
// ⚽ RANKING DE TORCIDAS
// ============================================================
router.get('/torcidas', async (req, res) => {
  try {
    const torcidas = await RankingTorcida.find().sort({ torcedores: -1 }).lean();
    res.json({
      totalTimes: torcidas.length,
      ranking: torcidas.map(t => ({
        time: t.time,
        torcedores: t.torcedores,
        porcentagem: t.porcentagem,
      })),
    });
  } catch (error) {
    console.error('❌ Erro ao buscar ranking de torcidas:', error);
    res.status(500).json({ error: 'Erro ao buscar ranking de torcidas', detalhes: error.message });
  }
});

// ============================================================
// 🏆 RANKING GERAL DA TEMPORADA
// ============================================================
// ============================================================
// 🏆 RANKING GERAL DA TEMPORADA (ATUALIZADO)
// ============================================================
router.get('/geral', async (req, res) => {
  try {
    // 1. Ordenamos APENAS pelo campo correto: totalPontos
    const geral = await RankingGeral.find()
      .sort({ totalPontos: -1 })
      .lean();

    if (!geral || geral.length === 0) {
      return res.status(404).json({ message: 'Nenhum ranking geral encontrado' });
    }

    res.json({
      totalUsuarios: geral.length,
      ranking: geral.map((r, i) => ({
        posicao: i + 1,
        apelido: r.apelido,
        timeCoracao: r.timeCoracao,
        // 2. 🔥 Forçamos o uso APENAS do totalPontos que calculamos no Service
        totalPontos: r.totalPontos || 0, 
        totalApostas: r.totalApostas,
      })),
    });
  } catch (error) {
    console.error('❌ Erro ao buscar ranking geral:', error);
    res.status(500).json({ error: 'Erro ao buscar ranking geral', detalhes: error.message });
  }
});
// ============================================================
// 🚀 REPROCESSAR TODOS OS RANKINGS (manual via painel admin)
// ============================================================
const RankingService = require('../services/RankingService');

router.post('/recalcular-rankings', async (req, res) => {
  try {
    const { rodadaId } = req.body;

    if (!rodadaId) {
      return res.status(400).json({ error: 'ID da rodada é obrigatório.' });
    }

    console.log(`🚀 Recalculando todos os rankings para a rodada ${rodadaId}...`);
    await RankingService.atualizarTudo(rodadaId);

    res.json({ message: '✅ Todos os rankings foram recalculados com sucesso!' });
  } catch (error) {
    console.error('❌ Erro ao recalcular rankings:', error);
    res.status(500).json({ error: 'Erro ao recalcular rankings.', detalhes: error.message });
  }
});


// ============================================================
// 🔄 REPROCESSAR RANKING PARCIAL DA RODADA (SEGURO)
// ============================================================
router.post('/rodada/:rodadaId/parcial', async (req, res) => {
  try {
    const { rodadaId } = req.params;

    console.log(`🔄 Recalculando RANKING PARCIAL da rodada ${rodadaId}...`);

    // Apenas ranking da rodada — não mexe em campeão, nem status da rodada
    const ranking = await RankingService.atualizarRankingRodada(rodadaId);

    res.json({
      success: true,
      message: "Ranking parcial recalculado com sucesso!",
      ranking
    });

  } catch (error) {
    console.error('❌ Erro ao recalcular ranking parcial:', error);
    res.status(500).json({
      error: 'Erro ao recalcular ranking parcial',
      detalhes: error.message
    });
  }
});


module.exports = router;
