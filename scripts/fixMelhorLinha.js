const mongoose = require('mongoose');
const Aposta = require('../models/Aposta');

require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/club_bolao')
  .then(async () => {
    console.log('🔧 Conectado ao MongoDB');
    const apostasCorrigidas = await Aposta.updateMany(
      { melhorLinha: { $type: 'string' } },
      {
        $set: {
          melhorLinha: {
            numero: 1,
            pontos: 0,
            acertos: 0
          }
        }
      }
    );

    console.log(`✅ ${apostasCorrigidas.modifiedCount} apostas corrigidas`);
    mongoose.connection.close();
  })
  .catch(err => console.error('❌ Erro ao conectar:', err));
