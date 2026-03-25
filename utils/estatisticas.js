// utils/estatisticas.js
const User = require('../models/User');
const Aposta = require('../models/Aposta');

// 🎯 ATUALIZAR ESTATÍSTICAS DO USUÁRIO
// utils/estatisticas.js

async function atualizarEstatisticasUsuario(userId) {
    try {
        const apostas = await Aposta.find({ 
            usuario: userId,
            status: 'paga' // Só conta o que foi pago
        });

        const estatisticas = {
            rodadasParticipadas: apostas.length,
            // 🚩 CORREÇÃO AQUI: Busca dentro de desempenhoRodada.pontuacaoRodada
            pontuacaoTotal: apostas.reduce((total, aposta) => {
                return total + (aposta.desempenhoRodada?.pontuacaoRodada || 0);
            }, 0),
            premiosGanhos: apostas.filter(aposta => aposta.vencedora === true).length,
            rankingGeral: "--"
        };

        // Salva de fato no banco Atlas
        await User.findByIdAndUpdate(userId, { estatisticas });
        
        console.log(`✅ Estatísticas do usuário ${userId} atualizadas no Atlas!`);
        return estatisticas;
    } catch (error) {
        console.error('❌ Erro ao atualizar estatísticas:', error);
    }
}

// 🎯 CALCULAR RANKING GERAL
async function calcularRankingGeral() {
    try {
        const usuarios = await User.find({});
        
        // Ordenar por pontuação total
        const ranking = usuarios
            .filter(user => user.estatisticas?.pontuacaoTotal > 0)
            .sort((a, b) => b.estatisticas.pontuacaoTotal - a.estatisticas.pontuacaoTotal)
            .map((user, index) => ({
                usuarioId: user._id,
                apelido: user.apelido,
                posicao: index + 1,
                pontos: user.estatisticas.pontuacaoTotal,
                rodadas: user.estatisticas.rodadasParticipadas
            }));
        
        return ranking;
        
    } catch (error) {
        console.error('❌ Erro ao calcular ranking geral:', error);
        throw error;
    }
}

module.exports = {
    atualizarEstatisticasUsuario,
    calcularRankingGeral
};
