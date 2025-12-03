// routes/palpites.js
const express = require('express');
const router = express.Router();

const { auth, protect, adminOnly } = require('../middleware/auth');
const Aposta = require('../models/Aposta');
const Rodada = require('../models/Rodada');

// ============================================================
// 🎯 GERAR NÚMERO DE CARTELA ÚNICO
// ============================================================
const gerarNumeroCartelaUnico = async () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  const numeroCartela = `CB${timestamp}${random}`;

  const existente = await Aposta.findOne({ numeroCartela });
  if (existente) {
    console.log('🔄 Cartela duplicada, gerando nova...');
    return await gerarNumeroCartelaUnico();
  }

  console.log('✅ Número de cartela gerado:', numeroCartela);
  return numeroCartela;
};

// ============================================================
// ✅ ROTA DE TESTE BÁSICA
// GET /api/palpites/test
// ============================================================
router.get('/test', auth, (req, res) => {
  console.log('✅ /api/palpites/test funcionando!');
  res.json({
    message: 'Rota de palpites funcionando!',
    user: req.user?.id || null,
  });
});

// ============================================================
// ✅ LISTAR APOSTAS DE UM USUÁRIO ESPECÍFICO (ADMIN OU O PRÓPRIO USER)
// GET /api/palpites/usuario/:id
// ============================================================
router.get('/usuario/:id', auth, async (req, res) => {
  try {
    const apostas = await Aposta.find({ usuario: req.params.id })
      .populate('rodada', 'nome numero status')
      .sort({ createdAt: -1 });

    res.json(apostas);
  } catch (error) {
    console.error('❌ Erro ao buscar apostas do usuário:', error);
    res.status(500).json({ error: 'Erro ao buscar apostas do usuário' });
  }
});

// ============================================================
// ✅ LISTAR APOSTAS DE UMA RODADA ESPECÍFICA (ADMIN)
// GET /api/palpites/rodada/:id
// ============================================================
router.get('/rodada/:id', auth, async (req, res) => {
  try {
    const apostas = await Aposta.find({ rodada: req.params.id })
      .populate('usuario', 'apelido email')
      .sort({ createdAt: -1 });

    res.json(apostas);
  } catch (error) {
    console.error('❌ Erro ao buscar apostas da rodada:', error);
    res.status(500).json({ error: 'Erro ao buscar apostas da rodada' });
  }
});

er.get('/minhas-apostas', auth, async (req, res) => {
  try {
    console.log('📥 Buscando apostas para usuário:', req.user.id);

    const apostas = await Aposta.find({ usuario: req.user.id })
      .populate('rodada', 'nome numero tipo status valorAposta dataFimPalpites jogos')
      .sort({ dataCriacao: -1 });

    res.json(apostas);
  } catch (error) {
    console.error('❌ Erro ao buscar apostas:', error);
    res.status(500).json({ error: 'Erro ao buscar apostas' });
  }
});

// ============================================================
// ✅ CRIAR NOVA APOSTA
// POST /api/palpites/
// body: { rodadaId, numLinhas, valor, palpites }
// ============================================================
router.post('/', auth, async (req, res) => {
  try {
    console.log('🎯 Recebendo aposta do usuário:', req.user.apelido);

    const { rodadaId, numLinhas, valor, palpites } = req.body;

    if (!rodadaId || !numLinhas || !valor || !palpites) {
      return res.status(400).json({ error: 'Dados incompletos para criar aposta' });
    }

    // valida rodada
    const rodada = await Rodada.findById(rodadaId);
    if (!rodada) {
      return res.status(404).json({ error: 'Rodada não encontrada' });
    }

    if (rodada.status !== 'ativa') {
      return res.status(400).json({ error: 'Rodada não está ativa' });
    }

    // gera número único
    const numeroCartela = await gerarNumeroCartelaUnico();

    // define tipo e status
    const tipo = rodada.tipo === 'brinde' ? 'brinde' : 'normal';
    const status = tipo === 'brinde' ? 'brinde' : 'pendente';

    const novaAposta = new Aposta({
      usuario: req.user.id,
      rodada: rodadaId,
      numLinhas: parseInt(numLinhas),
      valor: parseFloat(valor),
      numeroCartela,
      status,
      tipo,
      palpites: palpites.map((linha, index) => ({
        linha: index + 1,
        jogos: linha
      }))
    });

    await novaAposta.save();

    const apostaPopulada = await Aposta.findById(novaAposta._id)
      .populate('rodada', 'nome numero tipo status valorAposta dataFimPalpites jogos');

    res.json({
      success: true,
      message: tipo === 'brinde' ? '🎉 Aposta de brinde confirmada!' : '✅ Aposta salva com sucesso!',
      aposta: apostaPopulada,
      isBrinde: tipo === 'brinde'
    });
  } catch (error) {
    console.error('❌ ERRO CRÍTICO AO CRIAR APOSTA:', error);
    res.status(500).json({ error: 'Erro interno ao criar aposta' });
  }
});

// ============================================================
// ✅ LISTAR TODAS AS APOSTAS (painel admin/listagem geral)
// GET /api/palpites/
// pode filtrar via query ?usuario=...&rodada=...
// ============================================================
router.get('/', auth, async (req, res) => {
  try {
    const filtro = {};
    if (req.query.usuario) filtro.usuario = req.query.usuario;
    if (req.query.rodada) filtro.rodada = req.query.rodada;

    const apostas = await Aposta.find(filtro)
      .populate('usuario', 'apelido email')
      .populate('rodada', 'nome numero tipo status valorAposta')
      .sort({ createdAt: -1 });

    res.json(apostas);
  } catch (error) {
    console.error('❌ Erro ao buscar apostas:', error);
    res.status(500).json({ error: 'Erro ao buscar apostas' });
  }
});

// ============================================================
// ✅ BUSCAR UMA APOSTA ESPECÍFICA DO USUÁRIO LOGADO
// GET /api/palpites/:id
// ============================================================
router.get('/:id', auth, async (req, res) => {
  try {
    const aposta = await Aposta.findOne({
      _id: req.params.id,
      usuario: req.user.id
    }).populate('rodada', 'nome numero jogos tipo status dataFimPalpites');

    if (!aposta) {
      return res.status(404).json({ error: 'Aposta não encontrada' });
    }

    res.json(aposta);
  } catch (error) {
    console.error('❌ Erro ao buscar aposta:', error);
    res.status(500).json({ error: 'Erro ao buscar aposta' });
  }
});

module.exports = router;
