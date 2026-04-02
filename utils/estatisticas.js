// utils/estatisticas.js
const User = require('../models/User');
const Aposta = require('../models/Aposta');

// 🎯 ATUALIZAR ESTATÍSTICAS DO USUÁRIO
/*async function atualizarEstatisticasUsuario(userId) {
    try {
        const apostas = await Aposta.find({
            usuario: userId,
            status: { $in: ["paga", "brinde", "ativa", "campeao", "finalizada"] }
        }).populate('rodada');

        const rodadasUnicas = new Set(apostas.map(a => a.rodada._id.toString()));

        const estatisticas = {
            rodadasParticipadas: rodadasUnicas.size,

            pontuacaoTotal: apostas.reduce((total, aposta) => {
                return total + (aposta.desempenhoRodada?.pontuacaoRodada || 0);
            }, 0),

            premiosGanhos: apostas.filter(aposta =>
                (aposta.desempenhoRodada?.pontuacaoRodada || 0) > 20
            ).length,

            rankingGeral: '--',
            rankingMes: '--'
        };

        await User.findByIdAndUpdate(userId, { estatisticas });

        return estatisticas;

    } catch (error) {
        console.error('Erro ao atualizar estatísticas:', error);
        throw error;
    }
}*/

// 🎯 ATUALIZAR ESTATÍSTICAS DO USUÁRIO (Lógica de Soma Total)
async function atualizarEstatisticasUsuario(userId) {
    try {
        const apostas = await Aposta.find({
            usuario: userId,
            status: { $in: ["paga", "brinde", "ativa", "campeao", "finalizada"] }
        });

        const rodadasUnicas = new Set(apostas.map(a => a.rodada.toString()));

        // 🧮 NOVA LÓGICA DE SOMA TOTAL
        let pontuacaoTotalAcumulada = 0;

        apostas.forEach(aposta => {
            // Se o seu sistema salva os pontos por linha dentro de 'linhas' ou 'desempenhoDetalhado'
            // Vamos somar o total daquela cartela específica
            if (aposta.desempenhoRodada?.pontuacaoRodada) {
                // Se 'pontuacaoRodada' já for a soma da cartela toda:
                pontuacaoTotalAcumulada += aposta.desempenhoRodada.pontuacaoRodada;
            } else if (aposta.linhas && aposta.linhas.length > 0) {
                // Caso o total não esteja pronto, somamos cada linha da cartela
                const somaCartela = aposta.linhas.reduce((acc, linha) => acc + (linha.pontos || 0), 0);
                pontuacaoTotalAcumulada += somaCartela;
            }
        });

        const estatisticas = {
            rodadasParticipadas: rodadasUnicas.size,
            pontuacaoTotal: pontuacaoTotalAcumulada, // Aqui vai o 142 do seu exemplo
            rankingGeral: '--',
            rankingMes: '--'
        };

        await User.findByIdAndUpdate(userId, { estatisticas });
        return estatisticas;

    } catch (error) {
        console.error('Erro ao atualizar estatísticas:', error);
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
