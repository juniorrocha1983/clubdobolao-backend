const express = require("express");
const router = express.Router();
const PreAposta = require("../models/PreAposta");
const Aposta = require("../models/Aposta");
const { auth } = require("../middleware/auth");

/**
 * =========================================================
 * 🔵 CRIAR PRÉ-APOSTA
 * =========================================================
 */
router.post("/", auth, async (req, res) => {
    console.log("📥 RECEBIDO NA PRE-APOSTA:", req.body);

    try {
        const { rodadaId, palpites, numLinhas, valor, numeroCartela } = req.body;

        if (
            !rodadaId ||
            !palpites ||
            !numLinhas ||
            numeroCartela === undefined ||
            isNaN(Number(valor))
        ) {
            return res.status(400).json({ error: "Dados incompletos." });
        }





        const novaPreAposta = await PreAposta.create({
            usuario: req.user.id,
            rodada: rodadaId,
            palpites,
            numLinhas,
            valor,
            numeroCartela,
            status: "pendente"
        });

        return res.json({
            sucesso: true,
            preApostaId: novaPreAposta._id
        });

    } catch (error) {
        console.error("❌ ERRO CRIAR PRÉ-APOSTA:", error);
        res.status(500).json({ error: "Erro ao criar pré-aposta" });
    }
});

/**
 * =========================================================
 * 🟣 BUSCAR UMA PRÉ-APOSTA
 * =========================================================
 */
router.get("/:id", auth, async (req, res) => {
    try {
        const preAposta = await PreAposta.findOne({
            _id: req.params.id,
            usuario: req.user.id
        });

        if (!preAposta) return res.status(404).json({ error: "Pré-aposta não encontrada" });

        res.json(preAposta);

    } catch (error) {
        console.error("❌ ERRO BUSCAR PRÉ-APOSTA:", error);
        res.status(500).json({ error: "Erro ao buscar pré-aposta" });
    }
});

/**
 * =========================================================
 * 🟢 CONSULTAR STATUS
 * =========================================================
 */
router.get("/status/:id", auth, async (req, res) => {
    try {
        const preAposta = await PreAposta.findById(req.params.id);

        if (!preAposta) {
            return res.status(404).json({ error: "Pré-aposta não encontrada" });
        }

        res.json({ status: preAposta.status });

    } catch (error) {
        console.error("❌ ERRO STATUS PRÉ:", error);
        res.status(500).json({ error: "Erro ao consultar status" });
    }
});

/**
 * =========================================================
 * 🟡 CONFIRMAR PAGAMENTO (manual ou webhook)
 * =========================================================
 */
router.post("/confirmar/:id", async (req, res) => {
    try {
        const pre = await PreAposta.findById(req.params.id);
        if (!pre) return res.status(404).json({ error: "Pré-aposta não encontrada" });

        if (pre.status === "paga") {
            return res.json({ message: "Aposta já foi confirmada anteriormente." });
        }

        // Criar aposta real
        const aposta = await Aposta.create({
            usuario: pre.usuario,
            rodada: pre.rodada,
            palpites: pre.palpites,
            numLinhas: pre.numLinhas,
            valor: pre.valor,
            status: "paga",
            numeroCartela: pre.numeroCartela, // 🚀 AGORA EXISTE!
            dataPagamento: new Date()
        });

        pre.status = "paga";
        await pre.save();

        res.json({ sucesso: true, apostaId: aposta._id });

    } catch (error) {
        console.error("❌ ERRO CONFIRMAR APOSTA:", error);
        res.status(500).json({ error: "Erro ao confirmar aposta" });
    }
});

module.exports = router;
