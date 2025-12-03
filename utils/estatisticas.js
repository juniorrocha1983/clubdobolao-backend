// utils/estatisticas.js
const User = require('../models/User');
const Aposta = require('../models/Aposta');

// 🎯 ATUALIZAR ESTATÍSTICAS DO USUÁRIO
async function atualizarEstatisticasUsuario(userId) {
    try {
        console.log('📊 Atualizando estatísticas do usuário:', userId);
        
        // Buscar apostas do usuário
        const apostas = await Aposta.find({ 
            usuario: userId,
            status: 'paga'
        }).populate('rodada');
        
        // Calcular estatísticas
        const estatisticas = {
            rodadasParticipadas: apostas.length,
            pontuacaoTotal: apostas.reduce((total, aposta) => total + (aposta.pontos || 0), 0),
            premiosGanhos: apostas.filter(aposta => aposta.pontos > 20).length, // Exemplo
            rankingGeral: '--', // Será calculado comparando com outros usuários
            rankingMes: '--'   // Será calculado por mês
        };
        
        // Atualizar usuário
        await User.findByIdAndUpdate(userId, { estatisticas });
        
        console.log('✅ Estatísticas atualizadas para usuário:', userId);
        return estatisticas;
        
    } catch (error) {
        console.error('❌ Erro ao atualizar estatísticas:', error);
        throw error;
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