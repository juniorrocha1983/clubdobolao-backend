const mongoose = require('mongoose');

// =====================================================================
// JOGO DENTRO DA RODADA
// =====================================================================
const jogoSchema = new mongoose.Schema({
  timeMandante: { type: String, required: true },
  timeVisitante: { type: String, required: true },
  dataJogo: { type: Date, required: true },
  local: { type: String, default: null },

  tipoCampeonato: { type: String, default: null },

  placarMandante: { type: Number, default: null },
  placarVisitante: { type: Number, default: null },

  finalizado: { type: Boolean, default: false },

  ordem: { type: Number, default: 1 }
}, { _id: true });


// =====================================================================
// RODADA
// =====================================================================
const rodadaSchema = new mongoose.Schema({

  nome: {
    type: String,
    required: true,
    trim: true
  },

  // 🔥 número único da rodada (1, 2, 3, 4... )
  numero: {
    type: Number,
    required: true,
    index: true
  },

  // 🔥 tipo da rodada
  tipo: {
    type: String,
    enum: ['brinde', 'paga'], // rodada paga = aposta pix
    required: true
  },

  valorAposta: {
    type: Number,
    default: 0
  },

  dataInicio: {
    type: Date,
    required: true
  },

  dataFimPalpites: {
    type: Date,
    required: true,
    index: true
  },

  // status da rodada (não confundir com status da aposta)
  status: {
    type: String,
    enum: ['ativa', 'finalizada'],
    default: 'ativa'
  },

  dataFinalizacao: { type: Date },

  jogos: {
    type: [jogoSchema],
    required: true
  },

  criadaPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  apostas: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Aposta'
  }],

  ranking: [{
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    aposta: { type: mongoose.Schema.Types.ObjectId, ref: 'Aposta' },
    posicao: Number,
    pontuacao: Number,
    acertos: Number
  }],

  campeaoRodada: {
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    aposta: { type: mongoose.Schema.Types.ObjectId, ref: 'Aposta', default: null },
    apelido: { type: String, default: null },
    pontuacao: { type: Number, default: 0 },
    acertos: { type: Number, default: 0 }
  }

}, {
  timestamps: true
});


// =====================================================================
// INDEXES E OTIMIZAÇÕES
// =====================================================================
rodadaSchema.index({ numero: 1 }, { unique: true }); // rodada 1,2,3... única
rodadaSchema.index({ status: 1 }); // rodadas ativas


module.exports = mongoose.model('Rodada', rodadaSchema);
