// routes/apostas.js
const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const Aposta = require('../models/Aposta');
const Rodada = require('../models/Rodada');
const PreAposta = require("../models/PreAposta");


// 🎯 Gera número único de cartela
const gerarNumeroCartelaUnico = async () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `CB${timestamp}${random}`;
};


/* ==========================================================
   ✅ 1 — MINHAS APOSTAS (usuário logado)
   ========================================================== */
router.get('/minhas-apostas', auth, async (req, res) => {
  try {
    console.log('📥 Buscando apostas para usuário:', req.user.id);

    const apostas = await Aposta.find({ usuario: req.user.id })
      .populate('rodada', 'nome numero tipo status valorAposta dataFimPalpites jogos')
      .sort({ createdAt: -1 });

    res.json(apostas);
  } catch (error) {
    console.error('❌ Erro ao buscar apostas:', error);
    res.status(500).json({ error: 'Erro ao buscar apostas.' });
  }
});

router.get("/verificar/:rodadaId", auth, async (req, res) => {
    try {
        const { rodadaId } = req.params;

        // 🔥 Verifica SOMENTE aposta válida
        const aposta = await Aposta.findOne({
            usuario: req.user.id,
            rodada: rodadaId,
            status: { $in: ["paga", "brinde"] }
        });

        return res.json({ existe: !!aposta });

    } catch (error) {
        console.error("Erro verificar aposta:", error);
        return res.status(500).json({ existe: false });
    }
});



/* ==========================================================
   ✅ 2 — CARTELA ADMIN (usuário + rodada)
   ========================================================== */
router.get('/cartela/:usuarioId/:rodadaId', auth, adminOnly, async (req, res) => {
  try {
    const { usuarioId, rodadaId } = req.params;

    console.log("👁️ Buscando cartela:");
    console.log("Usuário:", usuarioId);
    console.log("Rodada:", rodadaId);

    const aposta = await Aposta.findOne({
      usuario: usuarioId,
      rodada: rodadaId
    })
      .populate("usuario", "apelido email time")
      .populate("rodada", "nome numero jogos");

    if (!aposta) {
      return res.status(404).json({ error: "Aposta não encontrada." });
    }

    res.json({
      usuario: aposta.usuario,
      rodada: aposta.rodada,
      palpites: aposta.palpites,
      pontuacao: aposta.desempenhoRodada?.pontuacaoRodada || 0,
      acertos: aposta.desempenhoRodada?.acertosRodada || 0,
      linhaVencedora: aposta.desempenhoRodada?.melhorLinhaRodada?.numero || null,
      numeroCartela: aposta.numeroCartela
    });

  } catch (error) {
    console.error("❌ Erro ao buscar cartela:", error);
    res.status(500).json({ error: "Erro ao buscar cartela", detalhes: error.message });
  }
});


/* ==========================================================
   ✅ 3 — CRIAR NOVA APOSTA (NORMAL ou BRINDE)
   ========================================================== */
router.post('/', auth, async (req, res) => {
  try {
    console.log('🎯 Criando aposta...');
    console.log('📦 Recebido:', req.body);

    const { rodada, rodadaId, numLinhas, tipo, palpites } = req.body;
    const userId = req.user.id;
    const rodadaReal = rodadaId || rodada;

    if (!rodadaReal || !palpites?.length || !numLinhas) {
      return res.status(400).json({ message: 'Dados incompletos.' });
    }

    const rodadaObj = await Rodada.findById(rodadaReal);
    if (!rodadaObj) {
      return res.status(404).json({ message: 'Rodada não encontrada.' });
    }

    // 🔒 Bloqueio contra aposta duplicada
    const apostaExistente = await Aposta.findOne({
      usuario: userId,
      rodada: rodadaObj._id
    });

    if (apostaExistente) {
      return res.status(400).json({ message: 'Você já possui aposta nesta rodada.' });
    }

    // 🔢 Número de cartela
    const numeroCartela = await gerarNumeroCartelaUnico();

    // 🧩 Conversão segura dos palpites
    const palpitesConvertidos = palpites.map(linha => ({
      linha: linha.linha,
      jogos: (linha.jogos || []).map(jogo => ({
        palpiteMandante: jogo.palpiteMandante ?? null,
        palpiteVisitante: jogo.palpiteVisitante ?? null,
        palpite: jogo.palpite || null,
        jogoId: jogo.jogoId || null
      }))
    }));


    /* ==========================================================
       🎁 APOSTA BRINDE
       ========================================================== */
    if (rodadaObj.tipo === "brinde") {

      const apostaBrinde = new Aposta({
        usuario: userId,
        rodada: rodadaObj._id,
        numLinhas,
        valor: 0,
        tipo: "brinde",
        status: "brinde",
        numeroCartela,
        palpites: palpitesConvertidos
      });

      await apostaBrinde.save();

      await Rodada.findByIdAndUpdate(
        rodadaObj._id,
        { $push: { apostas: apostaBrinde._id } }
      );

      return res.status(201).json({
        success: true,
        isBrinde: true,
        apostaId: apostaBrinde._id
      });
    }


    /* ==========================================================
       💰 APOSTA NORMAL (PIX)
       ========================================================== */
    const valorLinha = Number(rodadaObj.valorAposta) || 0;
    const valorTotal = valorLinha * numLinhas;

    const novaAposta = new Aposta({
      usuario: userId,
      rodada: rodadaObj._id,
      numLinhas,
      valor: valorTotal,
      tipo: "pix",
      status: "ativa",
      numeroCartela,
      palpites: palpitesConvertidos
    });

    await novaAposta.save();

    await Rodada.findByIdAndUpdate(
      rodadaObj._id,
      { $push: { apostas: novaAposta._id } }
    );

    return res.status(201).json({
      success: true,
      message: "Aposta criada com sucesso!",
      apostaId: novaAposta._id,
      numeroCartela: novaAposta.numeroCartela,
      valor: novaAposta.valor
    });

  } catch (error) {
    console.error('❌ Erro ao criar aposta:', error);
    return res.status(500).json({
      message: "Você já possui aposta nesta rodada.",
      detalhes: error.message
    });
  }
});


/* ==========================================================
   ✅ 4 — BUSCAR TODAS AS APOSTAS DA RODADA (ADMIN)
   ========================================================== */
router.get('/rodada/:rodadaId', auth, adminOnly, async (req, res) => {
  try {
    const apostas = await Aposta.find({ rodada: req.params.rodadaId })
      .populate('usuario', 'apelido email')
      .populate('rodada', 'nome')
      .sort({ createdAt: -1 });

    res.json(apostas);

  } catch (error) {
    console.error('❌ Erro ao buscar apostas da rodada:', error);
    res.status(500).json({ error: 'Erro ao buscar apostas da rodada' });
  }
});


/* ==========================================================
   💰 ROTA SEGURA — ARRECADAÇÃO DA RODADA (USUÁRIO)
   ========================================================== */

router.get('/rodada-arrecadacao/:rodadaId', auth, async (req, res) => {
  try {
    const { rodadaId } = req.params;

    // Buscar rodada
    const rodada = await Rodada.findById(rodadaId);
    if (!rodada) {
      return res.status(404).json({ error: "Rodada não encontrada." });
    }

    let apostas;

    if (rodada.tipo === "brinde") {
      // 🎁 Brinde → conta todas as apostas
      apostas = await Aposta.find({ rodada: rodadaId });
    } else {
      // 💸 Normal → somente apostas pagas
      apostas = await Aposta.find({ rodada: rodadaId, status: "paga" });
    }

    // Total de linhas
    const totalLinhas = apostas.reduce((soma, a) => soma + (a.numLinhas || 0), 0);

    // Total arrecadado (brinde = 0)
    const totalArrecadado =
      rodada.tipo === "brinde"
        ? 0
        : apostas.reduce((soma, a) => soma + (a.valor || 0), 0);

    res.json({
      totalArrecadado,
      premiacao: rodada.tipo === "brinde" ? 0 : totalArrecadado * 0.9,
      taxaBanca: rodada.tipo === "brinde" ? 0 : totalArrecadado * 0.1,
      totalApostas: apostas.length,
      totalLinhas
    });

  } catch (error) {
    console.error("❌ Erro ao gerar arrecadação:", error);
    res.status(500).json({ error: "Erro ao gerar arrecadação" });
  }
});


/* ==========================================================
   ⚠️ 5 — FINALIZAR APOSTA (raramente usado)
   ========================================================== */
router.put('/finalizar', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const aposta = await Aposta.findOne({
      usuario: userId,
      status: { $in: ['em_andamento', 'brinde'] }
    });

    if (!aposta) {
      return res.status(404).json({ error: 'Nenhuma aposta ativa encontrada.' });
    }

    aposta.status = 'finalizada';
    aposta.dataFinalizacao = new Date();

    await aposta.save();

    res.json({ message: 'Aposta finalizada com sucesso!', aposta });

  } catch (error) {
    console.error('❌ Erro ao finalizar aposta:', error);
    res.status(500).json({ error: 'Erro ao finalizar aposta', detalhes: error.message });
  }
});


/* ==========================================================
   ❗ 6 — BUSCAR UMA APOSTA (DETALHES)
   ========================================================== */
router.get('/:id', auth, async (req, res) => {
  try {
    const filtro = { _id: req.params.id };

    if (!req.user.isAdmin) filtro.usuario = req.user.id;

    const aposta = await Aposta.findOne(filtro)
      .populate('rodada', 'nome numero tipo valorAposta jogos')
      .populate('usuario', 'apelido');

    if (!aposta) {
      return res.status(404).json({ message: 'Aposta não encontrada.' });
    }

    res.json(aposta);

  } catch (error) {
    console.error('❌ Erro ao buscar aposta:', error);
    res.status(500).json({ message: 'Erro ao buscar aposta', details: error.message });
  }
});


/* ==========================================================
   💰 7 — STATUS DO PAGAMENTO (PIX)
   ========================================================== */
router.get('/status/:id', auth, async (req, res) => {
  try {
    const apostaId = req.params.id;

    // Busca aposta do usuário atual
    const aposta = await Aposta.findOne({
      _id: apostaId,
      usuario: req.user.id
    });

    if (!aposta) {
      return res.status(404).json({ error: "Aposta não encontrada." });
    }

    return res.json({
      status: aposta.status || "pendente"
    });

  } catch (error) {
    console.error("❌ Erro ao verificar status da aposta:", error);
    res.status(500).json({
      error: "Erro ao verificar status",
      detalhes: error.message
    });
  }
});


module.exports = router;



