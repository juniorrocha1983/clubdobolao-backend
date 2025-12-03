// models/Aposta.js
const mongoose = require('mongoose');

//
// PALPITES
//
const palpiteJogoSchema = new mongoose.Schema({
  jogoId: { type: mongoose.Schema.Types.ObjectId },
  palpite: { type: String, default: null },
  palpiteMandante: { type: Number, min: 0, max: 9, default: null },
  palpiteVisitante: { type: Number, min: 0, max: 9, default: null }
}, { _id: false });

const linhaPalpiteSchema = new mongoose.Schema({
  linha: { type: Number, required: true },
  jogos: { type: [palpiteJogoSchema], required: true }
}, { _id: false });


//
// APOSTA
//
const apostaSchema = new mongoose.Schema({

  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  rodada: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Rodada',
    required: true,
    index: true
  },

  numLinhas: { type: Number, required: true, min: 1 },
  valor: { type: Number, required: true, min: 0 },

  numeroCartela: { type: String, required: true, unique: true },

  //
  // TIPOS
  //
  tipo: {
    type: String,
    enum: ['pix', 'brinde', 'normal', 'campeao'],
    required: true
  },

  //
  // STATUS PERMITIDOS
  //
  status: {
    type: String,
    enum: [
      'ativa',
      'paga',
      'cancelada',
      'campeao',
      'brinde',
      'finalizada' // 🔥 FALTAVA ESTE e o sistema usa muito!
    ],
    required: true,
    index: true
  },

  palpites: { type: [linhaPalpiteSchema], required: true },

  dataPagamento: { type: Date },
  dataCriacao: { type: Date, default: Date.now },

  desempenhoRodada: {
    pontuacaoRodada: { type: Number, default: 0 },
    acertosRodada: { type: Number, default: 0 },
    melhorLinhaRodada: {
      numero: { type: Number, default: 1 },
      pontos: { type: Number, default: 0 },
      acertos: { type: Number, default: 0 }
    }
  },

  desempenhoGeral: {
    pontuacaoTotal: { type: Number, default: 0 },
    acertosTotais: { type: Number, default: 0 },
    rodadasJogadas: { type: Number, default: 0 }
  },

  campeaoRodada: { type: Boolean, default: false }

}, { timestamps: true });


//
// INDEX ÚNICO POR USUÁRIO + RODADA
//
apostaSchema.index({ usuario: 1, rodada: 1 }, { unique: true });


//
// PARSER
//
apostaSchema.statics.parsePlacar = function (p) {
  if (!p) return { m: null, v: null };

  if (typeof p.palpite === 'string') {
    const [a, b] = p.palpite.split('x').map(n => parseInt(n, 10));
    return { m: a ?? null, v: b ?? null };
  }

  return {
    m: Number.isFinite(p.palpiteMandante) ? p.palpiteMandante : null,
    v: Number.isFinite(p.palpiteVisitante) ? p.palpiteVisitante : null
  };
};

module.exports = mongoose.models.Aposta || mongoose.model('Aposta', apostaSchema);
