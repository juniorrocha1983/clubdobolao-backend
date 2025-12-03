// models/RankingTorcida.js
const mongoose = require('mongoose');

const RankingTorcidaSchema = new mongoose.Schema({
  time: { type: String, required: true },
  torcedores: { type: Number, default: 0 }, // ✅ quantidade de usuários por time
  porcentagem: { type: Number, default: 0 }, // usado no frontend
  atualizadoEm: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RankingTorcida', RankingTorcidaSchema);
