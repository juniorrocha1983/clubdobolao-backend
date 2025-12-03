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
   1️⃣ GERAR PAGAMENTO PIX (USANDO preApostaId)
============================================================ */
router.post("/pix", auth, async (req, res) => {
    try {
        const { preApostaId } = req.body;

        if (!preApostaId) {
            return res.status(400).json({ error: "preApostaId obrigatório." });
        }

        // Buscar pré-aposta
        const pre = await PreAposta.findById(preApostaId);
        if (!pre) {
            return res.status(404).json({ error: "Pré-aposta não encontrada." });
        }

        // Buscar usuário para pegar o CPF
        const usuario = await User.findById(req.user.id);
        if (!usuario || !usuario.cpf) {
            return res.status(400).json({ error: "Usuário sem CPF cadastrado." });
        }

        /* ============================================================
           🔎 DEBUG — ESSA PARTE VOCÊ PEDIU PARA EU INCLUIR
        ============================================================ */
        console.log("\n============ DEBUG ROTA PIX ============");
        console.log("📥 Body recebido:", req.body);
        console.log("📌 PRE encontrada:", pre);
        console.log("📌 pre.valor =", pre.valor, " | tipo:", typeof pre.valor);
        console.log("📌 Number(pre.valor) =", Number(pre.valor));
        console.log("========================================\n");
        /* ========================================================== */

        // Criar pagamento PIX Mercado Pago
        const pagamento = await mpPayment.create({
            body: {
                transaction_amount: Number(pre.valor),
                description: "Pagamento da Pré-Aposta " + preApostaId,
                payment_method_id: "pix",
                payer: {
                    email: usuario.email,
                    first_name: usuario.nomeCompleto?.split(" ")[0],
                    last_name: usuario.nomeCompleto?.split(" ").slice(1).join(" "),
                    identification: {
                        type: "CPF",
                        number: usuario.cpf
                    }
                },
                external_reference: preApostaId
            }
        });


        const infoPix = pagamento.point_of_interaction.transaction_data;

        return res.json({
            sucesso: true,
            valor: pre.valor,
            copia_cola: infoPix.qr_code,
            qr_code_base64: infoPix.qr_code_base64
        });

    } catch (error) {
        console.error("❌ ERRO PIX:", error);
        return res.status(500).json({ error: "Erro ao gerar PIX." });
    }
});


/* ============================================================
   2️⃣ WEBHOOK DO MERCADO PAGO
============================================================ */
router.post("/webhook", async (req, res) => {
    try {
        const data = req.body;

        if (data.type !== "payment") return res.sendStatus(200);

        const pagamento = await mpPayment.get({ id: data.data.id });

        if (pagamento.status !== "approved")
            return res.sendStatus(200);

        const preApostaId = pagamento.external_reference;

        const pre = await PreAposta.findById(preApostaId);
        if (!pre) return res.sendStatus(200);

        // Criar aposta final
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

        console.log("🎯 APOSTA PAGA VIA WEBHOOK:", aposta._id);

        return res.sendStatus(200);

    } catch (error) {
        console.log("❌ ERRO WEBHOOK:", error);
        return res.sendStatus(500);
    }
});


/* ============================================================
   3️⃣ CONFIRMAÇÃO MANUAL (opcional)
============================================================ */
router.post("/confirmar", auth, async (req, res) => {
    const { preApostaId } = req.body;

    const pre = await PreAposta.findOne({
        _id: preApostaId,
        usuario: req.user.id
    });

    if (!pre)
        return res.status(404).json({ error: "Pré-aposta não encontrada." });

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

    return res.json({ sucesso: true, aposta });
});


/* ============================================================
   🔵 SALVAR CPF DO USUÁRIO
============================================================ */
router.post("/salvar-cpf", auth, async (req, res) => {
    try {
        const { cpf } = req.body;

        if (!cpf) {
            return res.status(400).json({ error: "CPF é obrigatório." });
        }

        // Atualiza o CPF do usuário logado
        await User.findByIdAndUpdate(req.user.id, { cpf });

        res.json({ sucesso: true, mensagem: "CPF salvo com sucesso!" });

    } catch (err) {
        console.error("❌ Erro ao salvar CPF:", err);
        res.status(500).json({ error: "Erro ao salvar CPF" });
    }
});


module.exports = router;
