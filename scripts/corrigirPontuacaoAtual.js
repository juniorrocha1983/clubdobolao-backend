const mongoose = require("mongoose");
require('dotenv').config();

// 🔧 CONFIGURAÇÃO DO BANCO - AJUSTE CONFORME SEU .env
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/pitacos";

// 🎯 FUNÇÃO DE CÁLCULO CORRIGIDA (para usar no script)
async function calcularPontuacaoRodada(rodadaId) {
    const Aposta = require("../models/Aposta");
    const Rodada = require("../models/Rodada");
    
    const rodada = await Rodada.findById(rodadaId);
    if (!rodada) throw new Error("Rodada não encontrada");

    const apostas = await Aposta.find({ rodada: rodadaId, status: { $in: ["paga", "brinde"] } });
    console.log(`📊 Encontradas ${apostas.length} apostas para calcular`);

    let totalAtualizadas = 0;

    for (const aposta of apostas) {
        let totalPontos = 0;
        let totalAcertos = 0;
        let melhorLinha = { numero: 1, pontos: 0, acertos: 0 };

        console.log(`\n🎯 Calculando aposta ${aposta._id}...`);

        aposta.palpites.forEach((linha, linhaIndex) => {
            let pontosLinha = 0;
            let acertosLinha = 0;

            linha.jogos.forEach((palpiteObj, jogoIndex) => {
                const jogoReal = rodada.jogos[jogoIndex];
                const pontos = calcularPontosIndividual(palpiteObj, jogoReal);
                
                console.log(`    Jogo ${jogoIndex + 1}: ${palpiteObj.palpite} vs ${jogoReal.placarMandante}x${jogoReal.placarVisitante} = ${pontos} pontos`);
                
                pontosLinha += pontos;
                if (pontos > 0) acertosLinha++;
            });

            totalPontos += pontosLinha;
            totalAcertos += acertosLinha;

            // Encontrar melhor linha
            if (pontosLinha > melhorLinha.pontos) {
                melhorLinha = {
                    numero: linhaIndex + 1,
                    pontos: pontosLinha,
                    acertos: acertosLinha
                };
            }
        });

        aposta.pontuacao = totalPontos;
        aposta.acertos = totalAcertos;
        aposta.melhorLinha = melhorLinha;
        await aposta.save();
        
        console.log(`  ✅ Total: ${totalPontos} pontos, ${totalAcertos} acertos, Melhor linha: ${melhorLinha.numero}`);
        totalAtualizadas++;
    }

    return { message: `Pontuação calculada para ${totalAtualizadas} apostas` };
}

function calcularPontosIndividual(palpiteObj, jogoReal) {
    if (!jogoReal || jogoReal.placarMandante == null || jogoReal.placarVisitante == null)
        return 0;

    // ✅ CORREÇÃO: Converter string "0x3" para números
    let golsMandante, golsVisitante;
    
    if (palpiteObj.palpite && typeof palpiteObj.palpite === 'string') {
        // Formato novo: "0x3"
        [golsMandante, golsVisitante] = palpiteObj.palpite.split('x').map(Number);
    } else {
        // Formato legado: palpiteMandante/palpiteVisitante
        golsMandante = palpiteObj.palpiteMandante;
        golsVisitante = palpiteObj.palpiteVisitante;
    }

    // Verificar se os valores são válidos
    if (golsMandante == null || golsVisitante == null) return 0;

    // Placar exato = 5 pontos
    if (golsMandante === jogoReal.placarMandante && golsVisitante === jogoReal.placarVisitante)
        return 5;

    // Acertou resultado = 3 pontos
    const resultadoPalpite = golsMandante > golsVisitante ? "C" : golsMandante < golsVisitante ? "F" : "E";
    const resultadoReal = jogoReal.placarMandante > jogoReal.placarVisitante ? "C" : jogoReal.placarMandante < jogoReal.placarVisitante ? "F" : "E";

    return resultadoPalpite === resultadoReal ? 3 : 0;
}

// 🚀 EXECUÇÃO PRINCIPAL
async function main() {
    try {
        console.log("🔄 Conectando ao MongoDB...");
        await mongoose.connect(MONGODB_URI);
        console.log("✅ Conectado ao MongoDB");

        const rodadaId = "6907be6085f7c6f1cd78e9ba"; // SUA RODADA
        console.log(`🎯 Calculando pontuação para rodada: ${rodadaId}`);

        const resultado = await calcularPontuacaoRodada(rodadaId);
        
        console.log("\n🎉 " + resultado.message);
        
        // Verificar resultado
        const Aposta = require("../models/Aposta");
        const apostasComPontos = await Aposta.find({ 
            rodada: rodadaId, 
            pontuacao: { $gt: 0 } 
        });
        
        console.log(`\n📊 RESULTADO FINAL:`);
        console.log(`   ${apostasComPontos.length} apostas com pontuação > 0`);
        
        if (apostasComPontos.length > 0) {
            console.log("\n🏆 Apostas com pontuação:");
            apostasComPontos.forEach(aposta => {
                console.log(`   👤 ${aposta.usuario}: ${aposta.pontuacao} pontos (${aposta.acertos} acertos)`);
            });
        }

    } catch (error) {
        console.error("❌ Erro durante a correção:", error);
    } finally {
        await mongoose.disconnect();
        console.log("\n🔌 Desconectado do MongoDB");
        process.exit(0);
    }
}

// Executar
main();