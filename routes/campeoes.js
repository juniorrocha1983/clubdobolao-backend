const express = require("express");
const router = express.Router();
const campeoesController = require("../controllers/campeoesController");
const { auth, adminOnly } = require("../middleware/auth");


// PUBLIC
router.get("/public", campeoesController.listarPublicamente);

// 🔍 Buscar campeão por ID (corrigido)
const Campeao = require("../models/Campeao"); // <<< IMPORTANTE

router.get("/:id", auth, async (req, res) => {
    try {
        const campeao = await Campeao.findById(req.params.id)
            .populate("usuario", "apelido nomeCompleto email")
            .populate("rodada", "nome tipo tipoPremio");

        if (!campeao) {
            return res.status(404).json({ error: "Campeão não encontrado" });
        }

        // 🔥 GARANTE que envia o tipoPremio correto para o front
        const resposta = {
            _id: campeao._id,
            usuario: campeao.usuario,
            rodada: campeao.rodada,
            apelido: campeao.apelido,
            pontuacao: campeao.pontuacao,
            acertos: campeao.acertos,
            linhaVencedora: campeao.linhaVencedora,
            statusPremio: campeao.statusPremio,
            tipoPremio: campeao.tipoPremio || campeao.rodada?.tipo || "pix", // 👈 ESSA LINHA SALVA TUDO
            tipoPix: campeao.tipoPix,
            chavePix: campeao.chavePix,
            endereco: campeao.endereco,
            cep: campeao.cep,
            telefone: campeao.telefone,
            tamanhoCamisa: campeao.tamanhoCamisa
        };

        res.json(resposta);

    } catch (err) {
        console.error("❌ Erro ao buscar campeão:", err);
        res.status(500).json({ error: err.message });
    }
});

// ADMIN
router.get("/", adminOnly, campeoesController.listarCampeoes);
router.get("/rodada/:rodadaId", auth, campeoesController.buscarPorRodada);
router.get("/usuario/:usuarioId", auth, campeoesController.buscarPorUsuario);

module.exports = router;
