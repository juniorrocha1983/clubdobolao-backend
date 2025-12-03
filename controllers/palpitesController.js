const mongoose = require("mongoose");
const Aposta = require("../models/Aposta");
const Rodada = require("../models/Rodada");

exports.criarAposta = async (req, res) => {
  try {
    const { rodadaId, numLinhas, valor, tipo, status, palpites } = req.body;
    const usuarioId = req.user.id || req.body.usuarioId;

    console.log("🎯 [POST /api/apostas] Criando aposta...");
    console.log("📦 Corpo recebido:", req.body);

    if (!rodadaId || !palpites || palpites.length === 0) {
      return res.status(400).json({ message: "Dados incompletos para criar aposta." });
    }

    // 🔍 Buscar a rodada completa com os jogos
    const rodada = await Rodada.findById(rodadaId);
    if (!rodada) {
      return res.status(404).json({ message: "Rodada não encontrada." });
    }

    console.log("⚽ Jogos carregados da rodada:", rodada.jogos?.length || 0);
    if (!rodada.jogos || rodada.jogos.length === 0) {
      console.warn("⚠️ Nenhum jogo encontrado na rodada! Verifique o model ou o banco.");
    } else {
      rodada.jogos.forEach((jogo, idx) => {
        console.log(`   🏟️ Jogo ${idx + 1}: ${jogo.timeMandante} x ${jogo.timeVisitante} (ID: ${jogo._id})`);
      });
    }

    // 🔒 Verificar se o usuário já tem aposta nessa rodada
    const apostaExistente = await Aposta.findOne({ usuario: usuarioId, rodada: rodada._id });
    if (apostaExistente) {
      return res.status(400).json({ message: "Usuário já possui aposta nesta rodada." });
    }

    // 🧠 Converte palpites e vincula automaticamente os jogos da rodada
    const palpitesConvertidos = palpites.map((linha) => ({
      linha: linha.linha,
      jogos: (linha.jogos || []).map((jogo, idxJogo) => {
        // Faz o índice "girar" entre os jogos da rodada
        const jogoRodada = rodada.jogos[idxJogo % rodada.jogos.length];

        return {
          jogoId: jogoRodada?._id || null,
          palpiteMandante: jogo.palpiteMandante ?? null,
          palpiteVisitante: jogo.palpiteVisitante ?? null,
          palpite: `${jogo.palpiteMandante ?? ""}x${jogo.palpiteVisitante ?? ""}`
        };
      })
    }));


    const numeroCartela = `CB${Date.now()}${Math.floor(Math.random() * 999999)}`;
    const novaAposta = new Aposta({
      usuario: usuarioId,
      rodada: rodada._id,
      numLinhas,
      valor,
      tipo,
      status,
      numeroCartela,
      palpites: palpitesConvertidos
    });

    await novaAposta.save();
    console.log("✅ Aposta salva com sucesso!");
    res.status(201).json({
      message: "Aposta criada com sucesso!",
      aposta: novaAposta
    });

  } catch (error) {
    console.error("❌ Erro ao criar aposta:", error);
    res.status(500).json({ message: "Erro ao criar aposta.", error: error.message });
  }
};




/**
 * 🧮 Recalcular pontuação da rodada
 */
exports.recalcularPontuacao = async (req, res) => {
  try {
    const { rodadaId } = req.params;
    const resultado = await calcularPontuacaoRodada(rodadaId);
    res.json({ message: "Pontuação recalculada com sucesso", resultado });
  } catch (error) {
    console.error("❌ Erro ao recalcular pontuação:", error);
    res.status(500).json({ message: "Erro ao recalcular pontuação", error: error.message });
  }
};

/**
 * 📜 Listar palpites de uma rodada (admin)
 */
exports.listarPorRodada = async (req, res) => {
  try {
    const { rodadaId } = req.params;
    const apostas = await Aposta.find({ rodada: rodadaId })
      .populate("usuario", "apelido email")
      .populate("rodada", "nome numero tipo");

    res.json(apostas);
  } catch (error) {
    console.error("❌ Erro ao listar palpites:", error);
    res.status(500).json({ message: "Erro ao listar palpites.", error: error.message });
  }
};

/**
 * 📄 Buscar aposta do usuário logado
 */
exports.minhasApostas = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const apostas = await Aposta.find({ usuario: usuarioId })
      .populate("rodada", "nome numero tipo")
      .sort({ createdAt: -1 });

    res.json(apostas);
  } catch (error) {
    console.error("❌ Erro ao buscar apostas:", error);
    res.status(500).json({ message: "Erro ao buscar apostas.", error: error.message });
  }
};


/**
 * 👁️ Buscar cartela completa de um usuário em uma rodada
 * Usado no painel ADMIN — "Ver Cartela"
 */
exports.getCartelaCompleta = async (req, res) => {
  try {
    const { usuarioId, rodadaId } = req.params;

    console.log("🔍 Buscando cartela completa:");
    console.log("   Usuário:", usuarioId);
    console.log("   Rodada:", rodadaId);

    // 🔎 Buscar aposta
    const aposta = await Aposta.findOne({ usuario: usuarioId, rodada: rodadaId })
      .populate("usuario", "apelido email time")
      .populate("rodada");

    if (!aposta) {
      return res.status(404).json({ error: "Aposta não encontrada para este usuário nesta rodada." });
    }

    res.json({
      usuario: aposta.usuario,
      rodada: aposta.rodada,
      palpites: aposta.palpites,
      pontuacao: aposta.pontuacao || 0,
      acertos: aposta.acertos || 0,
      linhaVencedora: aposta.linhaVencedora || null,
      numeroCartela: aposta.numeroCartela
    });

  } catch (err) {
    console.error("❌ Erro ao buscar cartela:", err);
    res.status(500).json({
      error: "Erro ao carregar cartela.",
      detalhes: err.message
    });
  }
};
