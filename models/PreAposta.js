const mongoose = require("mongoose");

const PreApostaSchema = new mongoose.Schema({
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rodada: { type: mongoose.Schema.Types.ObjectId, ref: "Rodada", required: true },
    palpites: { type: Array, required: true },
    numLinhas: { type: Number, required: true },
    valor: { type: Number, required: true },
    numeroCartela: { type: Number, required: true },

    status: {
        type: String,
        enum: ["pendente", "aguardando_pagamento", "paga", "expirada"],
        default: "pendente"
    },

    dataCriacao: { type: Date, default: Date.now },
    dataPagamento: { type: Date }
});

module.exports = mongoose.model("PreAposta", PreApostaSchema);
