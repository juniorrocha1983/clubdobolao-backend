const mongoose = require("mongoose");

const CampeaoSchema = new mongoose.Schema({
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    rodada: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Rodada",
        required: true
    },

    aposta: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Aposta"
    },

    // 🧾 Dados do campeão
    apelido: { type: String, required: true },
    pontuacao: { type: Number, default: 0 },
    acertos: { type: Number, default: 0 },
    linhaVencedora: { type: Number, default: 0 },

    // 🏆 Dados da temporada
    temporada: { type: String, default: new Date().getFullYear().toString() },

    // 💰 Controle de prêmio (novo fluxo completo)
    statusPremio: {
        type: String,
        enum: ["pendente", "solicitado", "pago"],
        default: "pendente"
    },


    tipoPremio: {    // <<< ADICIONE ESTA LINHA
        type: String,
        enum: ["pix", "brinde"],
        required: true
    },

    tipoPix: { type: String, default: null },
    chavePix: { type: String, default: null },
    tipoPix: { type: String, default: null },
    chavePix: { type: String, default: null },

    // 🟢 ADICIONE AQUI
    nomeDestinatario: { type: String, default: null },

    // Dados de brinde
    tipoBrinde: { type: String },
    endereco: { type: String },
    cep: { type: String },
    telefone: { type: String },
    tamanhoCamisa: { type: String },
    dataSolicitacao: { type: Date, default: null },
    dataPagamento: { type: Date, default: null },

}, { timestamps: true });

// 🔍 Garantia: 1 usuário só pode ganhar 1 vez por rodada
CampeaoSchema.index({ usuario: 1, rodada: 1 }, { unique: true });

module.exports = mongoose.model("Campeao", CampeaoSchema);
