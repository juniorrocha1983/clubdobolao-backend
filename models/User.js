const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    nomeCompleto: {
        type: String,
        required: true
    },
    apelido: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    senha: {
        type: String,
        required: true
    },
    timeCoracao: {
        type: String,
        required: true
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
   cpf: {
    type: String,
    required: false,
    unique: true,   // impede duplicados
    sparse: true    // permite usuários sem CPF
},


    estatisticas: {
        rodadasParticipadas: { type: Number, default: 0 },
        pontuacaoTotal: { type: Number, default: 0 },
        premiosGanhos: { type: Number, default: 0 },
      
    },

    // 📅 DATA DE CADASTRO (utilizada no painel e nos históricos)
    dataCadastro: {
        type: Date,
        default: Date.now
    },

    // 🔐 RESET DE SENHA – NECESSÁRIO PARA /esqueci-senha e /resetar-senha
    resetToken: {
        type: String,
        default: null
    },

    resetTokenExpira: {
        type: Date,
        default: null
    }
});

module.exports = mongoose.model('User', userSchema);

