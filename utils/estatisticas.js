// utils/estatisticas.js
const User = require('../models/User');
const Aposta = require('../models/Aposta');

// 🎯 ATUALIZAR ESTATÍSTICAS DO USUÁRIO
async function atualizarEstatisticasUsuario(userId) {
    try {
        console.log('📊 Iniciando atualização de pontos para o usuário:', userId);
        
        // 1. Mudamos o filtro para aceitar 'paga' e 'brinde'
        const apostas = await Aposta.find({ 
            usuario: userId,
            status: { $in: ['paga', 'brinde'] }
        });
        
        // 2. Cálculo corrigido apontando para o lugar certo do seu JSON
        const pontuacaoCalculada = apostas.reduce((total, aposta) => {
            // No seu banco, o 5 está aqui dentro: desempenhoRodada -> pontuacaoRodada
            const pontosDaCartela = aposta.desempenhoRodada?.pontuacaoRodada || 0;
            return total + pontosDaCartela;
        }, 0);

        const estatisticas = {
            rodadasParticipadas: apostas.length,
            pontuacaoTotal: pontuacaoCalculada, 
            premiosGanhos: apostas.filter(aposta => aposta.campeaoRodada === true).length,
            rankingGeral: '--',
            rankingMes: '--'
        };
        
        // 3. O comando $set garante que o Atlas substitua os valores zerados
        const usuarioAtualizado = await User.findByIdAndUpdate(
            userId, 
            { $set: { estatisticas: estatisticas } },
            { new: true } // Retorna o dado novo para o log
        );
        
        console.log(`✅ Sucesso! O usuário ${usuarioAtualizado.apelido} agora tem ${pontuacaoCalculada} pontos no Atlas.`);
        return estatisticas;
        
    } catch (error) {
        console.error('❌ Erro fatal ao atualizar estatísticas:', error);
        throw error;
    }
}

// 🎯 CALCULAR RANKING GERAL
async function calcularRankingGeral() {
    try {
        // Busca usuários que tenham pontos no novo campo
        const usuarios = await User.find({ "estatisticas.pontuacaoTotal": { $gt: 0 } });
        
        return usuarios
            .sort((a, b) => (b.estatisticas.pontuacaoTotal || 0) - (a.estatisticas.pontuacaoTotal || 0))
            .map((user, index) => ({
                usuarioId: user._id,
                apelido: user.apelido,
                posicao: index + 1,
                pontos: user.estatisticas.pontuacaoTotal,
                rodadas: user.estatisticas.rodadasParticipadas
            }));
    } catch (error) {
        console.error('❌ Erro no Ranking Geral:', error);
        throw error;
    }
}

module.exports = {
    atualizarEstatisticasUsuario,
    calcularRankingGeral
};
