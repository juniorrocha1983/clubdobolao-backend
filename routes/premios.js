// routes/premios.js
const express = require("express");
const router = express.Router();
const Campeao = require("../models/Campeao");
const { auth } = require("../middleware/auth");

/* ============================================================
   🎁 SOLICITAR BRINDE (camiseta)
============================================================ */
router.post("/solicitar-brinde", auth, async (req, res) => {
    try {
        const { campeaoId, endereco, cep, telefone, tamanho } = req.body;
        const userId = req.user.id;

        if (!campeaoId || !endereco || !cep || !telefone || !tamanho) {
            return res.status(400).json({ error: "Dados incompletos." });
        }

        const camp = await Campeao.findById(campeaoId)
            .populate("usuario", "_id");

        if (!camp)
            return res.status(404).json({ error: "Campeão não encontrado." });

        // Comparação correta entre IDs
        if (!camp.usuario || camp.usuario._id.toString() !== userId.toString()) {
            return res.status(403).json({ error: "Você não pode solicitar prêmio de outro usuário." });
        }

        if (camp.statusPremio === "pago") {
            return res.status(400).json({ error: "Prêmio já foi enviado anteriormente." });
        }

        if (camp.statusPremio === "solicitado") {
            return res.status(400).json({ error: "Você já solicitou este prêmio." });
        }

        camp.statusPremio = "solicitado";
        camp.tipoPremio = "brinde";
        camp.tamanhoCamisa = tamanho;
        camp.endereco = endereco;
        camp.cep = cep;
        camp.telefone = telefone;
        camp.dataSolicitacao = new Date();

        await camp.save();

        return res.json({
            sucesso: true,
            message: "Solicitação de brinde enviada!",
            camp
        });

    } catch (err) {
        console.error("❌ ERRO BRINDE:", err);
        return res.status(500).json({ error: "Erro ao solicitar brinde." });
    }
});


/*router.post("/solicitar", auth, async (req, res) => {
    try {
        const { campeaoId, tipoPix, chavePix, nomeDestinatario } = req.body;
        const userId = req.user.id;

        if (!campeaoId || !tipoPix || !chavePix || !nomeDestinatario) {
            return res.status(400).json({ error: "Dados incompletos." });
        }

        const camp = await Campeao.findById(campeaoId)
            .populate("usuario", "_id");

        if (!camp)
            return res.status(404).json({ error: "Registro de campeão não encontrado." });

        if (!camp.usuario || camp.usuario._id.toString() !== userId.toString()) {
            return res.status(403).json({ error: "Você não pode solicitar prêmio de outro usuário." });
        }

        if (camp.statusPremio === "pago") {
            return res.status(400).json({ error: "Este prêmio já foi pago anteriormente." });
        }

        if (camp.statusPremio === "solicitado") {
            return res.status(400).json({ error: "Você já solicitou este prêmio." });
        }

        camp.statusPremio = "solicitado";
        camp.tipoPremio = "pix";
        camp.tipoPix = tipoPix;
        camp.chavePix = chavePix;
        camp.nomeDestinatario = nomeDestinatario; // 🟢 SALVANDO O NOME DA CONTA
        camp.dataSolicitacao = new Date();

        await camp.save();

        return res.json({
            sucesso: true,
            message: "Solicitação enviada com sucesso!",
            campeao: camp
        });

    } catch (err) {
        console.error("❌ ERRO PIX PREMIO:", err);
        return res.status(500).json({ error: "Erro ao solicitar prêmio." });
    }
});
*/

router.post("/solicitar", auth, async (req, res) => {
    try {

        const {
            campeaoId,
            tipoPix,
            chavePix,
            nomeDestinatario,
            telefoneContato
        } = req.body;

        const userId = req.user.id;

        if (
            !campeaoId ||
            !tipoPix ||
            !chavePix ||
            !nomeDestinatario
        ) {
            return res.status(400).json({
                error: "Dados incompletos."
            });
        }

        const camp = await Campeao.findById(campeaoId)
            .populate("usuario", "_id");

        if (!camp) {
            return res.status(404).json({
                error: "Registro de campeão não encontrado."
            });
        }

        if (
            !camp.usuario ||
            camp.usuario._id.toString() !== userId.toString()
        ) {
            return res.status(403).json({
                error: "Você não pode solicitar prêmio de outro usuário."
            });
        }

        if (camp.statusPremio === "pago") {
            return res.status(400).json({
                error: "Este prêmio já foi pago anteriormente."
            });
        }

        if (camp.statusPremio === "solicitado") {
            return res.status(400).json({
                error: "Você já solicitou este prêmio."
            });
        }

        camp.statusPremio = "solicitado";

        // PIX
        camp.tipoPremio = "pix";
        camp.tipoPix = tipoPix;
        camp.chavePix = chavePix;

        // Dados do recebedor
        camp.nomeDestinatario = nomeDestinatario;

        // NOVO CAMPO
        camp.telefone = telefoneContato || "";

        camp.dataSolicitacao = new Date();

        await camp.save();

        return res.json({
            sucesso: true,
            message: "Solicitação enviada com sucesso!",
            campeao: camp
        });

    } catch (err) {

        console.error("❌ ERRO PIX PREMIO:", err);

        return res.status(500).json({
            error: "Erro ao solicitar prêmio."
        });
    }
});

module.exports = router;
