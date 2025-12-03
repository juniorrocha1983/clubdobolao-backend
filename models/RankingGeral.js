const mongoose = require('mongoose');

const RankingGeralSchema = new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
  apelido: String,
  timeCoracao: String,
  totalPontos: { type: Number, default: 0 },
  totalApostas: { type: Number, default: 0 },
  posicao: Number,
  atualizadoEm: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RankingGeral', RankingGeralSchema);
