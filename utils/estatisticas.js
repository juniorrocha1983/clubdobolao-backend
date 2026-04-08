// utils/estatisticas.js
const User = require('../models/User');
const Aposta = require('../models/Aposta');

function atualizarEstatisticas(estatisticas) {
    // Se o backend enviar dados extras de vitórias ou participações, usamos aqui
    const elementos = {
        'participações': estatisticas.rodadasParticipadas || 0,
        'vitorias': estatisticas.vitorias || 0
    };

    for (const [id, valor] of Object.entries(elementos)) {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = valor;
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
