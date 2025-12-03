// controllers/campeoesController.js
const Campeao = require("../models/Campeao");
const Aposta = require("../models/Aposta");
const Rodada = require("../models/Rodada");


/* ============================================================
   🏆 REGISTRAR CAMPEÃO(ÕES) DA RODADA
   ============================================================ */
const registrarCampeao = async (rodadaId) => {
    try {
        console.log(`🏆 Registrando campeão(ões) da rodada ${rodadaId}...`);

        const rodada = await Rodada.findById(rodadaId);
        if (!rodada) return console.warn("⚠ Rodada não encontrada.");

        // ❌ 1. Se houver jogo sem placar, não registra
        const jogosPendentes = rodada.jogos.some(j =>
            j.placarMandante === null || j.placarVisitante === null
        );
        if (jogosPendentes) {
            console.log("⛔ Rodada ainda não está totalmente finalizada.");
            return;
        }

        // ❌ 2. Evita registrar campeões duas vezes
        const jaTem = await Campeao.findOne({ rodada: rodadaId });
        if (jaTem) {
            console.log("⛔ Campeão já registrado — ignorando.");
            return;
        }

        // 🔥 3. Buscar apostas já pontuadas
        const apostas = await Aposta.find({ rodada: rodadaId })
            .populate("usuario", "apelido")
            .lean();

        if (!apostas.length) {
            console.log("⚠ Nenhuma aposta encontrada.");
            return;
        }

        // Garante que cada aposta possui desempenhoRodada
        for (const a of apostas) {
            if (!a.desempenhoRodada || a.desempenhoRodada.pontuacaoRodada == null) {

                const melhor = (a.palpites || []).reduce(
                    (best, linha) =>
                        linha.pontosLinha > best.pontos
                            ? { pontos: linha.pontosLinha, acertos: linha.acertos || 0 }
                            : best,
                    { pontos: 0, acertos: 0 }
                );

                a.desempenhoRodada = {
                    pontuacaoRodada: melhor.pontos,
                    acertosRodada: melhor.acertos,
                    melhorLinhaRodada: { numero: 1, pontos: melhor.pontos, acertos: melhor.acertos }
                };
            }
        }

        // 🏁 4. Maior pontuação da rodada
        const maiorPontuacao = Math.max(
            ...apostas.map(a => a.desempenhoRodada.pontuacaoRodada)
        );

        // 👑 5. Filtrar campeões (empate permitido)
        const campeoes = apostas.filter(
            a => a.desempenhoRodada.pontuacaoRodada === maiorPontuacao
        );

        console.log(`🏆 Encontrados ${campeoes.length} campeão(ões)`);

        // 🎁 Define tipo de prêmio automaticamente:
        // BRINDE → rodada.tipo = "brinde"
        // PIX → rodada.tipo = "paga"
        const tipoPremioRodada =
            rodada.tipo === "brinde" ? "brinde" : "pix";

        for (const c of campeoes) {

            // 🔄 Atualiza aposta do campeão
            await Aposta.updateOne({ _id: c._id }, { status: "campeao" });

            // 🏆 Criar/atualizar registro
            await Campeao.findOneAndUpdate(
                { usuario: c.usuario?._id, rodada: rodadaId },
                {
                    usuario: c.usuario?._id,
                    rodada: rodadaId,
                    aposta: c._id,
                    apelido: c.usuario?.apelido || "Desconhecido",
                    pontuacao: c.desempenhoRodada.pontuacaoRodada,
                    acertos: c.desempenhoRodada.acertosRodada,
                    linhaVencedora: c.desempenhoRodada.melhorLinhaRodada.numero,

                    // ⭐ ⭐ AQUI ESTÁ A CORREÇÃO ⭐ ⭐
                    tipoPremio: tipoPremioRodada,

                    statusPremio: "pendente",
                    dataSolicitacao: null,
                    dataPagamento: null
                },
                { upsert: true, new: true }
            );
        }

        // 🔄 6. Salva campeões dentro da rodada
        rodada.campeaoRodada = campeoes.map(c => ({
            usuario: c.usuario._id,
            aposta: c._id,
            apelido: c.usuario.apelido,
            pontuacao: c.desempenhoRodada.pontuacaoRodada,
            acertos: c.desempenhoRodada.acertosRodada,
            tipoPremio: tipoPremioRodada
        }));

        await rodada.save();

        console.log("✔ Campeões registrados com sucesso.");

    } catch (err) {
        console.error("❌ Erro ao registrar campeões:", err);
    }
};


/* ============================================================
   📌 LISTAR CAMPEÕES (ADMIN)
   ============================================================ */
const listarCampeoes = async (req, res) => {
    try {
        const campeoes = await Campeao.find()
            .populate("usuario", "apelido email")
            .populate("rodada", "nome numero tipo")
            .sort({ createdAt: -1 });

        res.json(campeoes);
    } catch (err) {
        res.status(500).json({ error: "Erro ao listar campeões" });
    }
};


/* ============================================================
   📌 BUSCAR POR RODADA
   ============================================================ */
const buscarPorRodada = async (req, res) => {
    try {
        const campeoes = await Campeao.find({ rodada: req.params.rodadaId })
            .populate("usuario", "apelido email");

        res.json(campeoes);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar campeões da rodada" });
    }
};


/* ============================================================
   📌 BUSCAR POR USUÁRIO
   ============================================================ */
const buscarPorUsuario = async (req, res) => {
    try {
        const campeoes = await Campeao.find({ usuario: req.params.usuarioId })
            .populate("rodada", "nome numero tipo dataFinalizacao");

        res.json(campeoes);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar campeões do usuário" });
    }
};


/* ============================================================
   📌 LISTAGEM PÚBLICA (GALERIA)
   ============================================================ */
const listarPublicamente = async (req, res) => {
    try {
        const campeoes = await Campeao.find()
            .populate("usuario", "apelido imagem timeCoracao")
            .populate("rodada", "numero nome tipo")
            .sort({ "rodada.numero": -1 })
            .limit(10);

        const resposta = campeoes.map(c => ({
            rodada: c.rodada?.numero || "–",
            nome: c.apelido || c.usuario?.apelido || "Desconhecido",
            pontos: c.pontuacao || 0,
            imagem: c.usuario?.imagem || null,
            tipoPremio: c.tipoPremio, // ⭐ IMPORTANTE PARA O FRONT
            time:
                c.usuario?.timeCoracao
                    ?.normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/\s+/g, "-")
                    .toLowerCase() || "default",
        }));

        res.json(resposta);
    } catch (error) {
        res.status(500).json({ erro: "Erro ao buscar campeões" });
    }
};

module.exports = {
    registrarCampeao,
    listarCampeoes,
    buscarPorRodada,
    buscarPorUsuario,
    listarPublicamente
};
