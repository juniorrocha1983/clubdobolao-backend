const express = require("express");
const router = express.Router();
const { auth, adminOnly } = require("../middleware/auth");
const Rodada = require("../models/Rodada");
const User = require("../models/User");
const Aposta = require("../models/Aposta");

// ✅ HEALTH CHECK
router.get("/health", auth, adminOnly, async (req, res) => {
  try {
    const rodadas = await Rodada.countDocuments();
    const usuarios = await User.countDocuments();
    const apostas = await Aposta.countDocuments();


    res.json({
      status: "OK",
      banco: "Conectado",
      rodadas,
      usuarios,
      apostas,
      timestamp: new Date().toISOString()
    });


  } catch (error) {
    console.error("❌ Health check failed:", error);
    res.status(500).json({ error: "Erro ao verificar status", detalhes: error.message });
  }
});

// ✅ CRIAR RODADA
router.post("/rodadas", auth, adminOnly, async (req, res) => {
  try {
    const { nome, numero, dataInicio, dataFimPalpites, valorAposta, jogos, tipo } = req.body;


    if (!nome || !numero || !dataInicio || !dataFimPalpites) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes" });
    }

    const isBrinde = tipo === "brinde";
    const valorFinal = isBrinde ? 0 : valorAposta || 5;

    const novaRodada = new Rodada({
      nome,
      numero: parseInt(numero),
      dataInicio: new Date(dataInicio),
      dataFimPalpites: new Date(dataFimPalpites),
      valorAposta: valorFinal,
      tipo: tipo || "normal",
      isBrinde,
      status: "ativa",
      jogos: jogos || [],
      criadaPor: req.user.id
    });

    await novaRodada.save();
    console.log(`✅ Rodada criada: ${nome}`);

    res.json({ message: "Rodada criada com sucesso!", rodada: novaRodada });


  } catch (error) {
    console.error("❌ Erro ao criar rodada:", error);
    res.status(500).json({ error: "Erro ao criar rodada", detalhes: error.message });
  }
});

// ✅ LISTAR RODADAS (com filtro opcional por status)
router.get("/rodadas", auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.query;
    const filtro = status ? { status } : {};


    const rodadas = await Rodada.find(filtro).sort({ createdAt: -1 });
    res.json(rodadas);


  } catch (error) {
    console.error("❌ Erro ao buscar rodadas:", error);
    res.status(500).json({ error: "Erro ao buscar rodadas" });
  }
});

// ✅ BUSCAR RODADA POR ID
router.get("/rodadas/:id", auth, adminOnly, async (req, res) => {
  try {
    const rodada = await Rodada.findById(req.params.id);
    if (!rodada) return res.status(404).json({ error: "Rodada não encontrada" });
    res.json(rodada);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar rodada", detalhes: error.message });
  }
});

// ✅ EXCLUIR RODADA
router.delete("/rodadas/:id", auth, adminOnly, async (req, res) => {
  try {
    const rodada = await Rodada.findById(req.params.id);
    if (!rodada) return res.status(404).json({ error: "Rodada não encontrada" });


    const apostasCount = await Aposta.countDocuments({ rodada: rodada._id });
    if (apostasCount > 0) {
      return res.status(400).json({ error: "Rodada possui apostas e não pode ser excluída" });
    }

    await rodada.deleteOne();
    res.json({ message: "Rodada excluída com sucesso!" });


  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir rodada", detalhes: error.message });
  }
});

// ✅ LISTAR USUÁRIOS
router.get("/usuarios", auth, adminOnly, async (req, res) => {
  try {
    const usuarios = await User.find({}, "apelido email isAdmin timeCoracao createdAt")
      .sort({ createdAt: -1 });
    res.json(usuarios);
  } catch (error) {
    console.error("❌ Erro ao listar usuários:", error);
    res.status(500).json({ error: "Erro ao listar usuários" });
  }
});


function calcularDistribuicao(apostas) {
  const dist = {};
  apostas.forEach(a => {
    const key = `${a.numLinhas || 0} linhas`;
    dist[key] = (dist[key] || 0) + 1;
  });
  return dist;
}


// ✅ FINANCEIRO
/*router.get("/financeiro", auth, adminOnly, async (req, res) => {
  try {
    const apostasPagas = await Aposta.find({
      status: "paga",
      tipo: { $in: ["normal", "pix"] }
    });

    const totalArrecadado = apostasPagas.reduce((soma, a) => soma + (a.valor || 0), 0);


    const premioRodada = totalArrecadado * 0.9;
    const taxaBanca = totalArrecadado * 0.1;

    res.json({
      totalArrecadado,
      premioRodada,
      taxaBanca,
      atualizadoEm: new Date().toISOString()
    });


  } catch (error) {
    console.error("❌ Erro financeiro:", error);
    res.status(500).json({ error: "Erro ao calcular financeiro" });
  }
});*/

// ✅ FINANCEIRO
router.get("/financeiro", auth, adminOnly, async (req, res) => {
  try {
    // pega qualquer aposta paga, independente se é pix ou normal
    const apostasPagas = await Aposta.find({ status: "paga" });

    const totalArrecadado = apostasPagas.reduce((soma, a) => soma + (a.valor || 0), 0);

    const premioRodada = totalArrecadado * 0.9;
    const taxaBanca = totalArrecadado * 0.1;

    res.json({
      totalArrecadado,
      premioRodada,
      taxaBanca,
      distribuicao: calcularDistribuicao(apostasPagas),
      atualizadoEm: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Erro financeiro:", error);
    res.status(500).json({ error: "Erro ao calcular financeiro" });
  }
});



// ✅ LISTAR RODADAS FINALIZADAS (para aba Ganhadores)
router.get("/rodadas-finalizadas", auth, adminOnly, async (req, res) => {
  try {
    const rodadas = await Rodada.find({ status: "finalizada" })
      .sort({ dataFinalizacao: -1 })
      .lean();


    if (!rodadas.length) {
      return res.status(404).json({ message: "Nenhuma rodada finalizada encontrada." });
    }

    res.json(rodadas);


  } catch (error) {
    console.error("❌ Erro ao buscar rodadas finalizadas:", error);
    res.status(500).json({ error: "Erro ao buscar rodadas finalizadas" });
  }
});

// ===============================
// ROTAS DE GANHADORES (USANDO MODELO CAMPEAO)
// ===============================

const Campeao = require("../models/Campeao");

// Rodadas finalizadas para o select do admin
router.get("/rodadas-finalizadas", auth, adminOnly, async (req, res) => {
  try {
    const rodadas = await Rodada.find({ status: "finalizada" })
      .sort({ dataFinalizacao: -1 });

    res.json(rodadas);
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar rodadas finalizadas" });
  }
});

// ===============================
// 🟢 LISTAR SOLICITAÇÕES DE PRÊMIOS
// ===============================
router.get("/campeoes/solicitados", auth, adminOnly, async (req, res) => {
  try {
    const lista = await Campeao.find({ statusPremio: "solicitado" })
      .populate("usuario", "apelido email")
      .populate("rodada", "nome numero");

    res.json(lista);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GANHADORES OFICIAIS — puxando do modelo Campeao
router.get("/campeoes/:rodadaId", auth, adminOnly, async (req, res) => {
  try {
    const { rodadaId } = req.params;

    const campeoes = await Campeao.find({ rodada: rodadaId })
      .populate("usuario", "apelido email timeCoracao")
      .populate("aposta", "_id")  // <-- AQUI! PEGAR ID DA APOSTA
      .sort({ pontuacao: -1 });

    const rodada = await Rodada.findById(rodadaId);

    res.json({
      rodada,
      campeoes
    });

  } catch (err) {
    console.error("Erro ao buscar campeões:", err);
    res.status(500).json({ error: "Erro ao buscar campeões" });
  }
});


// 📜 HISTÓRICO DO USUÁRIO (ADMIN)
router.get("/usuarios/historico/:userId", auth, adminOnly, async (req, res) => {
  try {
    const apostas = await Aposta.find({ usuario: req.params.userId })
      .populate("rodada")
      .sort({ createdAt: -1 });

    res.json(apostas);
  } catch (err) {
    console.error("Erro ao buscar histórico:", err);
    res.status(500).json({ error: "Erro ao carregar histórico." });
  }
});

// 🎁 SOLICITAÇÃO DE PRÊMIO (ADMIN)
router.get("/usuarios/premio/:userId", auth, adminOnly, async (req, res) => {
  try {
    const usuario = await User.findById(req.params.userId);
    res.json(usuario.solicitacaoPremio || null);
  } catch (err) {
    console.error("Erro ao buscar solicitação:", err);
    res.status(500).json({ error: "Erro ao buscar solicitação." });
  }
});



// ===============================
// 🟢 MARCAR PRÊMIO COMO PAGO
// ===============================
router.put("/campeoes/:id/pagar", auth, adminOnly, async (req, res) => {
  try {
    const camp = await Campeao.findById(req.params.id);

    if (!camp) {
      return res.status(404).json({ error: "Registro não encontrado." });
    }

    camp.statusPremio = "pago";
    camp.dataPagamento = new Date();

    await camp.save();

    res.json({ message: "Pagamento confirmado!", campeao: camp });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





module.exports = router;
