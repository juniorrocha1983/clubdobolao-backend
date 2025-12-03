// scripts/migrarPontosPorJogo.js
const mongoose = require("mongoose");
require('dotenv').config();

async function migrarDados() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/seubanco");
    console.log("🔄 Conectado ao MongoDB para migração...");

    const Aposta = require("../models/Aposta");
    const Rodada = require("../models/Rodada");
    
    // Buscar todas as apostas com pontuação > 0
    const apostas = await Aposta.find({ pontuacao: { $gt: 0 } });
    console.log(`📊 Encontradas ${apostas.length} apostas para migrar`);

    for (const aposta of apostas) {
      const rodada = await Rodada.findById(aposta.rodada);
      if (!rodada) continue;

      console.log(`🔄 Migrando aposta ${aposta._id}...`);

      aposta.palpites.forEach((linha, linhaIndex) => {
        let pontosLinha = 0;
        let acertosLinha = 0;

        linha.jogos.forEach((palpiteObj, jogoIndex) => {
          const jogoReal = rodada.jogos[jogoIndex];
          
          // Recalcular pontos para este jogo
          let pontos = 0;
          let acertou = false;

          if (jogoReal && jogoReal.placarMandante != null && jogoReal.placarVisitante != null) {
            let golsMandante, golsVisitante;
            
            if (palpiteObj.palpite && typeof palpiteObj.palpite === 'string') {
              [golsMandante, golsVisitante] = palpiteObj.palpite.split('x').map(Number);
            } else {
              golsMandante = palpiteObj.palpiteMandante;
              golsVisitante = palpiteObj.palpiteVisitante;
            }

            if (golsMandante != null && golsVisitante != null) {
              // Placar exato
              if (golsMandante === jogoReal.placarMandante && golsVisitante === jogoReal.placarVisitante) {
                pontos = 5;
                acertou = true;
              } else {
                // Acertou resultado
                const resultadoPalpite = golsMandante > golsVisitante ? "C" : golsMandante < golsVisitante ? "F" : "E";
                const resultadoReal = jogoReal.placarMandante > jogoReal.placarVisitante ? "C" : jogoReal.placarMandante < jogoReal.placarVisitante ? "F" : "E";
                
                if (resultadoPalpite === resultadoReal) {
                  pontos = 3;
                  acertou = true;
                }
              }
            }
          }

          // Atualizar campos
          palpiteObj.pontos = pontos;
          palpiteObj.acertou = acertou;
          pontosLinha += pontos;
          if (pontos > 0) acertosLinha++;
        });

        // Atualizar linha
        linha.pontosLinha = pontosLinha;
        linha.acertosLinha = acertosLinha;
      });

      await aposta.save();
      console.log(`✅ Aposta ${aposta._id} migrada`);
    }

    console.log("🎉 Migração concluída com sucesso!");
    
  } catch (error) {
    console.error("❌ Erro na migração:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Desconectado do MongoDB");
  }
}

migrarDados();