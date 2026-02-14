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

router.post("/salvar-cpf", auth, async (req, res) => {
    try {
        const { cpf } = req.body;

        if (!cpf || cpf.length !== 11) {
            return res.status(400).json({ error: "CPF inválido." });
        }

        const usuario = await User.findById(req.user.id);

        if (!usuario) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        usuario.cpf = cpf;
        await usuario.save();

        return res.json({ sucesso: true });

    } catch (error) {
        console.error("Erro ao salvar CPF:", error);
        return res.status(500).json({ error: "Erro interno." });
    }
});

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

        console.log("🔥 RESPOSTA COMPLETA MP:", JSON.stringify(pagamento, null, 2));

        // 🔥 AQUI ESTÁ A CORREÇÃO
        const data = pagamento;

        if (!data.point_of_interaction) {
            return res.status(400).json({
                error: "Mercado Pago não retornou QR Code.",
                detalhes: data
            });
        }

        const infoPix = data.point_of_interaction.transaction_data;

        pre.status = "aguardando_pagamento";
        await pre.save();

        return res.json({
            sucesso: true,
            valor: pre.valor,
            copia_cola: infoPix.qr_code,
            qr_code_base64: infoPix.qr_code_base64
        });

    } catch (error) {
        console.error("❌ ERRO PIX:", error);
        return res.status(500).json({
            error: "Erro ao gerar PIX.",
            detalhes: error.message
        });
    }
});



/* ============================================================
   2️⃣ WEBHOOK
============================================================ */
/* ============================================================
   2️⃣ WEBHOOK MERCADO PAGO — DEFINITIVO E SEGURO
============================================================ */
router.post("/webhook", async (req, res) => {
    try {
        console.log("📩 WEBHOOK RECEBIDO:", JSON.stringify(req.body, null, 2));

        const body = req.body;

        // 🔒 Ignora eventos que não sejam pagamento
        if (body.type !== "payment" || !body.data?.id) {
            return res.sendStatus(200);
        }

        let pagamento;

        try {
            pagamento = await mpPayment.get({
                id: body.data.id
            });
        } catch (err) {
            console.log("⚠️ Pagamento não encontrado no MP");
            return res.sendStatus(200);
        }

        // 🔥 IMPORTANTE: SDK retorna objeto direto
        if (!pagamento || pagamento.status !== "approved") {
            console.log("⏳ Pagamento ainda não aprovado:", pagamento?.status);
            return res.sendStatus(200);
        }

        const preApostaId = pagamento.external_reference;

        if (!preApostaId) {
            console.log("⚠️ Pagamento sem external_reference");
            return res.sendStatus(200);
        }

        const pre = await PreAposta.findById(preApostaId);

        if (!pre) {
            console.log("⚠️ Pré-aposta não encontrada:", preApostaId);
            return res.sendStatus(200);
        }

        // 🔒 VERIFICA SE JÁ EXISTE APOSTA (ÍNDICE ÚNICO PROTEGE)
        let apostaExistente = await Aposta.findOne({
            usuario: pre.usuario,
            rodada: pre.rodada
        });

        if (!apostaExistente) {

            await Aposta.create({
                usuario: pre.usuario,
                rodada: pre.rodada,
                palpites: pre.palpites,
                numLinhas: pre.numLinhas,
                valor: pre.valor,
                tipo: "pix",
                status: "paga",
                numeroCartela: String(pre.numeroCartela),
                dataPagamento: new Date()
            });

            console.log("🎯 APOSTA CRIADA COM SUCESSO");
        } else {
            console.log("⚠️ Aposta já existia — não criou novamente");
        }

        // ✅ Atualiza pré-aposta SEMPRE
        pre.status = "paga";
        pre.dataPagamento = new Date();
        await pre.save();

        console.log("✅ PRE-APOSTA ATUALIZADA PARA PAGA");

        return res.sendStatus(200);

    } catch (error) {
        console.log("❌ ERRO WEBHOOK:", error);
        return res.sendStatus(200); // nunca retornar 500 para MP
    }
});



module.exports = router;





