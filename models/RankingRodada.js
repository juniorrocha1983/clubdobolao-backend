const mongoose = require('mongoose');

const RankingRodadaSchema = new mongoose.Schema({
  rodadaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rodada', required: true },
  rodadaNome: String,
  numero: Number,
  status: { type: String, default: 'ativa' },

  ranking: [
    {
      usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      apelido: String,
      timeCoracao: String,
      melhorLinha: {
        numero: Number,
        pontos: Number,
        acertos: Number
      },
      posicao: Number,
      premiacao: { type: Number, default: 0 },
      createdAt: Date
    }
  ],

  totalArrecadado: { type: Number, default: 0 },
  premiacaoTotal: { type: Number, default: 0 },
  participantes: { type: Number, default: 0 },

  atualizadoEm: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RankingRodada', RankingRodadaSchema);
