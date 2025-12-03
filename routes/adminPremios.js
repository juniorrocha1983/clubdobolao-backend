// routes/adminPremios.js
const express = require("express");
const router = express.Router();
const Campeao = require("../models/Campeao");
const { auth, adminOnly } = require("../middleware/auth");

// 📌 Lista tudo que foi solicitado e ainda não pago
router.get("/solicitacoes", auth, adminOnly, async (req, res) => {
    try {
        const lista = await Campeao.find({ statusPremio: "solicitado" })
            .populate("usuario", "nomeCompleto apelido email")
            .populate("rodada", "nome");

        res.json(lista);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🟢 Admin confirma pagamento
router.put("/pagar/:id", auth, adminOnly, async (req, res) => {
    try {
        const campeao = await Campeao.findById(req.params.id);

        if (!campeao)
            return res.status(404).json({ error: "Registro não encontrado." });

        if (campeao.statusPremio === "pago") {
            return res.status(400).json({ error: "Prêmio já está marcado como pago." });
        }

        campeao.statusPremio = "pago";
        campeao.dataPagamento = new Date();

        await campeao.save();

        res.json({
            message: "Prêmio marcado como PAGO!",
            campeao
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
