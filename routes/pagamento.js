const express = require("express");
const router = express.Router();

const PreAposta = require("../models/PreAposta");
const Aposta = require("../models/Aposta");
const User = require("../models/User");
const { auth } = require("../middleware/auth");

const { MercadoPagoConfig, Payment } = require("mercadopago");

const mpClient = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN
});

const mpPayment = new Payment(mpClient);


/* ============================================================
   1️⃣ GERAR PIX
============================================================ */
router.post("/pix", auth, async (req, res) => {
    try {
        const { preApostaId } = req.body;

        if (!preApostaId)
            return res.status(400).json({ error: "preApostaId obrigatório." });

        const pre = await PreAposta.findById(preApostaId);
        if (!pre)
            return res.status(404).json({ error: "Pré-aposta não encontrada." });

        const usuario = await User.findById(req.user.id);
        if (!usuario || !usuario.cpf)
            return res.status(400).json({ error: "Usuário sem CPF cadastrado." });

        const cpfLimpo = usuario.cpf.replace(/\D/g, "");

        console.log("🔥 TOKEN:", process.env.MP_ACCESS_TOKEN);
        console.log("🔥 Valor enviado:", Number(pre.valor));

        const pagamento = await mpPayment.create({
            body: {
                transaction_amount: Number(pre.valor),
                description: "Pagamento Pré-Aposta",
                payment_method_id: "pix",
                payer: {
                    email: usuario.email,
                    identification: {
                        type: "CPF",
                        number: cpfLimpo
                    }
                },
                external_reference: preApostaId
            }
        });

        console.log("🔥 RESPOSTA COMPLETA MP:", JSON.stringify(pagamento.body, null, 2));

        const data = pagamento.body;

        if (!data.point_of_interaction) {
            return res.status(400).json({
                error: "Mercado Pago não retornou QR Code.",
                detalhes: data
            });
        }

        const infoPix = data.point_of_interaction.transaction_data;

        // 🔥 Atualiza status
        pre.status = "aguardando_pagamento";
        await pre.save();

        return res.json({
            sucesso: true,
            valor: pre.valor,
            copia_cola: infoPix.qr_code,
            qr_code_base64: infoPix.qr_code_base64
        });

    } catch (error) {
        console.error("❌ ERRO PIX:", error.response?.data || error);
        return res.status(500).json({
            error: "Erro ao gerar PIX.",
            detalhes: error.response?.data || error.message
        });
    }
});


/* ============================================================
   2️⃣ WEBHOOK
============================================================ */
router.post("/webhook", async (req, res) => {
    try {
        const body = req.body;

        if (body.type !== "payment")
            return res.sendStatus(200);
        let pagamento;

        try {
            pagamento = await mpPayment.get({
                id: body.data.id
            });
        } catch (err) {
            console.log("⚠️ Pagamento não encontrado (teste do MP). Ignorando.");
            return res.sendStatus(200);
        }


        const paymentData = pagamento.body;

        console.log("📩 WEBHOOK RECEBIDO:", paymentData.status);

        if (paymentData.status !== "approved")
            return res.sendStatus(200);

        const preApostaId = paymentData.external_reference;

        const pre = await PreAposta.findById(preApostaId);
        if (!pre) return res.sendStatus(200);

        const aposta = await Aposta.create({
            usuario: pre.usuario,
            rodada: pre.rodada,
            palpites: pre.palpites,
            numLinhas: pre.numLinhas,
            valor: pre.valor,
            tipo: "pix",
            status: "paga",
            numeroCartela: pre.numeroCartela,
            dataPagamento: new Date()
        });

        pre.status = "paga";
        pre.dataPagamento = new Date();
        await pre.save();

        console.log("🎯 APOSTA PAGA:", aposta._id);

        return res.sendStatus(200);

    } catch (error) {
        console.log("❌ ERRO WEBHOOK:", error);
        return res.sendStatus(500);
    }
});


module.exports = router;
