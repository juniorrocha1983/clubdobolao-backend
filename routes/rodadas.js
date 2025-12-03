// routes/rodadas.js - VERSÃO ATUALIZADA COM RANKING AUTOMÁTICO
const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const Rodada = require('../models/Rodada');
const Aposta = require('../models/Aposta');
const RankingService = require('../services/RankingService'); // ✅ integração direta
const RankingRodada = require('../models/RankingRodada');

// ==========================================================
// ✅ BUSCAR RODADA ATIVA
// ==========================================================
router.get('/ativa', auth, async (req, res) => {
  try {
    console.log('🔍 Buscando rodada ativa...');
    const rodadaAtiva = await Rodada.findOne({ status: 'ativa' })
      .sort({ dataFimPalpites: 1 })
      .lean();

    if (!rodadaAtiva) {
      console.log('⚠️ Nenhuma rodada ativa encontrada.');
      return res.status(404).json({ error: 'Nenhuma rodada ativa no momento' });
    }

    rodadaAtiva.jogos = rodadaAtiva.jogos || [];
    rodadaAtiva.nome = rodadaAtiva.nome || 'Rodada sem nome';

    console.log(`✅ Rodada ativa encontrada: ${rodadaAtiva.nome}`);
    res.json(rodadaAtiva);
  } catch (error) {
    console.error('❌ Erro ao buscar rodada ativa:', error);
    res.status(500).json({ error: 'Erro ao buscar rodada ativa', detalhes: error.message });
  }
});

// ==========================================================
// ✅ LISTAR TODAS AS RODADAS
// ==========================================================
router.get('/', auth, async (req, res) => {
  try {
    console.log('📋 Buscando todas as rodadas...');
    const rodadas = await Rodada.find().sort({ dataInicio: -1 });
    console.log(`✅ ${rodadas.length} rodadas encontradas.`);
    res.json(rodadas);
  } catch (error) {
    console.error('❌ Erro ao buscar rodadas:', error);
    res.status(500).json({ error: 'Erro ao buscar rodadas' });
  }
});

// ==========================================================
// ✅ BUSCAR RODADA POR ID
// ==========================================================
router.get('/:id', auth, async (req, res) => {
  try {
    const rodada = await Rodada.findById(req.params.id);
    if (!rodada) return res.status(404).json({ error: 'Rodada não encontrada' });

    console.log(`✅ Rodada encontrada: ${rodada.nome}`);
    res.json(rodada);
  } catch (error) {
    console.error('❌ Erro ao buscar rodada por ID:', error);
    res.status(500).json({ error: 'Erro ao buscar rodada', detalhes: error.message });
  }
});

// ==========================================================
// ✅ CRIAR NOVA RODADA (ADMIN)
// ==========================================================
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const novaRodada = new Rodada(req.body);
    await novaRodada.save();
    console.log(`🆕 Nova rodada criada: ${novaRodada.nome}`);
    res.status(201).json(novaRodada);
  } catch (error) {
    console.error('❌ Erro ao criar rodada:', error);
    res.status(500).json({ error: 'Erro ao criar rodada' });
  }
});

// ==========================================================
// ⚙️ ATUALIZAR JOGO ESPECÍFICO + RANKING AUTOMÁTICO (versão corrigida)
// ==========================================================
/*router.put('/:rodadaId/jogo/:index', auth, async (req, res) => {
  try {
    const { rodadaId, index } = req.params;
    const { placarMandante, placarVisitante, finalizado } = req.body;

    const rodada = await Rodada.findById(rodadaId);
    if (!rodada) return res.status(404).json({ error: 'Rodada não encontrada' });

    const jogo = rodada.jogos[index];
    if (!jogo) return res.status(404).json({ error: 'Jogo não encontrado' });

    // Atualiza placares e status
    jogo.placarMandante = placarMandante;
    jogo.placarVisitante = placarVisitante;
    jogo.finalizado = finalizado ?? true;

    await rodada.save();

    console.log(`⚽ Jogo ${index} atualizado: ${jogo.timeMandante} ${jogo.placarMandante}x${jogo.placarVisitante} ${jogo.timeVisitante}`);

    // ✅ Se o jogo foi finalizado, recalcula ranking automaticamente
    if (jogo.finalizado) {
      console.log('📊 Iniciando recálculo do ranking...');

      // 🚀 Corrigido: usa a nova função completa
      await RankingService.atualizarTudo(rodadaId);

      console.log('💾 Rankings atualizados com sucesso!');

      // ✅ Finaliza rodada automaticamente se todos os jogos estiverem encerrados
      const todosFinalizados = rodada.jogos.every(j => j.finalizado);
      if (todosFinalizados && rodada.status !== 'finalizada') {
        rodada.status = 'finalizada';
        rodada.dataFinalizacao = new Date();
        await rodada.save();

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🏁 RODADA "${rodada.nome}" FINALIZADA AUTOMATICAMENTE!`);
        console.log(`📅 Data: ${new Date().toLocaleString('pt-BR')}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }

      return res.json({
        message: todosFinalizados
          ? `🏁 Rodada "${rodada.nome}" finalizada automaticamente!`
          : 'Jogo finalizado e rankings recalculados com sucesso.',
        rodada: rodada.nome,
        status: rodada.status
      });
    }

    res.json({ message: 'Jogo atualizado (não finalizado)', jogo });
  } catch (error) {
    console.error('❌ Erro ao atualizar jogo:', error);
    res.status(500).json({ error: 'Erro ao atualizar jogo', detalhes: error.message });
  }
});*/


// ==========================================================
// ⚙️ ATUALIZAR JOGO + RANKING AUTOMÁTICO + FINALIZAÇÃO AUTOMÁTICA
// ==========================================================
router.put('/:rodadaId/jogo/:index', auth, adminOnly, async (req, res) => {
  try {
    const { rodadaId, index } = req.params;
    const { placarMandante, placarVisitante, finalizado } = req.body;

    console.log(`🔧 Atualizando jogo ${index} da rodada ${rodadaId}...`);

    // 1. Buscar rodada
    const rodada = await Rodada.findById(rodadaId);
    if (!rodada) {
      return res.status(404).json({ error: 'Rodada não encontrada' });
    }

    // 2. Verificar se o jogo existe
    const jogo = rodada.jogos[index];
    if (!jogo) {
      return res.status(404).json({ error: 'Jogo não encontrado' });
    }

    // 3. Atualizar placar e status
    jogo.placarMandante = Number(placarMandante ?? jogo.placarMandante);
    jogo.placarVisitante = Number(placarVisitante ?? jogo.placarVisitante);

    // ❗ Só altera finalizado se o frontend realmente mandar true/false
    if (typeof finalizado === "boolean") {
      jogo.finalizado = finalizado;
    }


    await rodada.save();

    console.log(`⚽ Jogo atualizado: ${jogo.timeMandante} ${jogo.placarMandante}x${jogo.placarVisitante} ${jogo.timeVisitante}`);
    console.log(`📌 Finalizado: ${jogo.finalizado}`);

    // ⚠ Quando finalizar um jogo, só recalcular o ranking parcial!
    if (jogo.finalizado === true) {
      console.log('📊 Jogo finalizado. Recalculando ranking parcial...');
      await RankingService.atualizarRankingRodada(rodadaId); // apenas parcial
    }



    // 7. Retorno padrão
    return res.json({
      message: 'Jogo atualizado com sucesso!',
      jogo,
      rodadaFinalizada: false
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar jogo:', error);
    res.status(500).json({
      error: 'Erro ao atualizar jogo',
      detalhes: error.message
    });
  }
});


// ==========================================================
// 🐛 ROTA DE DEBUG (INSPEÇÃO RÁPIDA)
// ==========================================================
router.get('/:id/debug', auth, async (req, res) => {
  try {
    const rodada = await Rodada.findById(req.params.id);
    const apostas = await Aposta.find({ rodada: req.params.id })
      .populate('usuario', 'apelido email');

    if (!rodada) {
      return res.status(404).json({ error: 'Rodada não encontrada' });
    }

    res.json({
      rodada: {
        _id: rodada._id,
        nome: rodada.nome,
        status: rodada.status,
        totalJogos: rodada.jogos.length,
        totalApostas: apostas.length,
        jogos: rodada.jogos.map(j => ({
          timeMandante: j.timeMandante,
          timeVisitante: j.timeVisitante,
          placarMandante: j.placarMandante,
          placarVisitante: j.placarVisitante,
          finalizado: j.finalizado
        }))
      }
    });
  } catch (error) {
    console.error('Erro no debug:', error);
    res.status(500).json({ error: error.message });
  }
});


// 🏁 FINALIZAR RODADA (ADMIN)
router.put("/:rodadaId/finalizar", auth, adminOnly, async (req, res) => {
  try {
    const { rodadaId } = req.params;

    console.log(`🏁 Finalizando rodada: ${rodadaId}`);

    // 1. Buscar rodada
    const rodada = await Rodada.findById(rodadaId);
    if (!rodada)
      return res.status(404).json({ error: "Rodada não encontrada" });

    // 2. Garantir que todos os jogos estão finalizados
    const jogosFinalizados = rodada.jogos.every(j => j.finalizado === true);

    if (!jogosFinalizados) {
      return res.status(400).json({
        error: "Existem jogos não finalizados. Finalize todos antes."
      });
    }

    // 3. Marcar rodada como finalizada
    rodada.status = "finalizada";
    rodada.dataFinalizacao = new Date();
    await rodada.save();

    // 4. Atualizar rankings (rodada + geral + torcidas)
    await RankingService.atualizarTudo(rodadaId);

    // 5. Buscar ranking da rodada
    const rankingRodada = await RankingRodada.findOne({ rodadaId });

    if (!rankingRodada || rankingRodada.ranking.length === 0) {
      return res.json({
        message: "Rodada finalizada, mas sem apostas válidas.",
        rodada
      });
    }

    // 6. Identificar campeão da rodada
    const melhorPontuacao = rankingRodada.ranking[0].melhorLinha.pontos;

    const campeoes = rankingRodada.ranking.filter(
      r => r.melhorLinha.pontos === melhorPontuacao
    );

    // Campeão oficial = primeiro da lista
    const vencedor = campeoes[0];

    console.log(
      `🏆 Campeão da Rodada: ${vencedor.apelido} (${vencedor.melhorLinha.pontos} pts)`
    );

    // 7. Atualizar apostas (somente marcações, sem alterar outras)
    await Aposta.updateMany(
      { rodada: rodadaId },
      { $set: { campeaoRodada: false } }
    );

    await Aposta.updateMany(
      { usuario: vencedor.usuarioId, rodada: rodadaId },
      { $set: { campeaoRodada: true, status: "campeao" } }
    );

    // 8. Salvar campeão na rodada
  rodada.campeaoRodada = {
  usuario: vencedor.usuarioId,
  apelido: vencedor.apelido,
  pontuacao: vencedor.melhorLinha.pontos,
  acertos: vencedor.melhorLinha.acertos,
  tipoPremio: rodada.tipo === "brinde" ? "brinde" : "pix"
};


    await rodada.save();

    return res.json({
      message: `Rodada "${rodada.nome}" finalizada com sucesso!`,
      rodada,
      campeao: rodada.campeaoRodada,
      ranking: rankingRodada.ranking
    });

  } catch (error) {
    console.error("❌ Erro ao finalizar rodada:", error);
    res.status(500).json({
      error: "Erro ao finalizar rodada.",
      detalhes: error.message
    });
  }
});






module.exports = router;
