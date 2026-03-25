// utils/estatisticas.js
const User = require('../models/User');
const Aposta = require('../models/Aposta');

// 🎯 ATUALIZAR ESTATÍSTICAS DO USUÁRIO
async function atualizarEstatisticasUsuario(userId) {
    try {
        console.log('📊 Atualizando estatísticas do usuário no Atlas:', userId);
        
        // 1. Buscar apostas do usuário (Pagas e Brindes)
        // Mudamos o filtro para incluir 'brinde', senão elas não somam no ranking
        const apostas = await Aposta.find({ 
            usuario: userId,
            status: { $in: ['paga', 'brinde'] }
        });
        
        // 2. Calcular estatísticas lendo os campos corretos do seu banco
        const estatisticas = {
            rodadasParticipadas: apostas.length,
            
            // 🔥 CORREÇÃO CRUCIAL: O ponto está em desempenhoRodada.pontuacaoRodada
            pontuacaoTotal: apostas.reduce((total, aposta) => {
                const pontosDestaAposta = aposta.desempenhoRodada?.pontuacaoRodada || 0;
                return total + pontosDestaAposta;
            }, 0),

            // Exemplo: Conta quantas vezes ele foi campeão ou teve pontuação alta
            premiosGanhos: apostas.filter(aposta => aposta.campeaoRodada === true).length,
            
            rankingGeral: '--', 
            rankingMes: '--'   
        };
        
        // 3. Salvar de fato no campo "estatisticas" do documento do Usuário
        await User.findByIdAndUpdate(userId, { 
            $set: { estatisticas: estatisticas } 
        });
        
        console.log(`✅ Sucesso! Usuário agora tem ${estatisticas.pontuacaoTotal} pontos acumulados.`);
        return estatisticas;
        
    } catch (error) {
        console.error('❌ Erro ao atualizar estatísticas:', error);
        throw error;
    }
}

// 🎯 CALCULAR RANKING GERAL (Busca direto dos usuários atualizados)
async function calcularRankingGeral() {
    try {
        // Busca usuários que tenham estatísticas e pelo menos 1 ponto
        const usuarios = await User.find({ "estatisticas.pontuacaoTotal": { $gt: 0 } });
        
        // Ordenar por pontuação total acumulada
        const ranking = usuarios
            .sort((a, b) => (b.estatisticas.pontuacaoTotal || 0) - (a.estatisticas.pontuacaoTotal || 0))
            .map((user, index) => ({
                usuarioId: user._id,
                apelido: user.apelido || "Participante",
                posicao: index + 1,
                pontos: user.estatisticas.pontuacaoTotal || 0,
                rodadas: user.estatisticas.rodadasParticipadas || 0,
                timeCoracao: user.timeCoracao
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
