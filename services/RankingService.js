// services/RankingService.js
const Aposta = require('../models/Aposta');
const Rodada = require('../models/Rodada');
const User = require('../models/User');
const RankingRodada = require('../models/RankingRodada');
const RankingGeral = require('../models/RankingGeral');
const RankingTorcida = require('../models/RankingTorcida');
const { registrarCampeao } = require("../controllers/campeoesController");

class RankingService {

    _extrairPlacar(p) {
        if (!p) return null;
        if (typeof p.palpite === "string") {
            const [m, v] = p.palpite.split(/[xX-]/).map(Number);
            return [m, v];
        }
        return [
            Number.isFinite(p.palpiteMandante) ? p.palpiteMandante : null,
            Number.isFinite(p.palpiteVisitante) ? p.palpiteVisitante : null
        ];
    }

    _resultado([m, v]) {
        if (m > v) return "mandante";
        if (m < v) return "visitante";
        return "empate";
    }

    _pontuar(palpite, real) {
        if (!real || real.placarMandante == null) return 0;
        const p = this._extrairPlacar(palpite);
        if (!p || p[0] == null || p[1] == null) return 0;
        const realPlacar = [real.placarMandante, real.placarVisitante];
        if (p[0] === realPlacar[0] && p[1] === realPlacar[1]) return 5;
        if (this._resultado(p) === this._resultado(realPlacar)) return 3;
        return 0;
    }

    async atualizarRankingRodada(rodadaId) {
        const rodada = await Rodada.findById(rodadaId);
        if (!rodada) throw new Error("Rodada não encontrada");

        const apostas = await Aposta.find({
            rodada: rodadaId,
            status: { $in: ["ativa", "paga", "brinde", "finalizada", "campeao"] }
        }).populate("usuario", "apelido timeCoracao");

        const resultados = rodada.jogos;
        const rankingData = [];
        for (const aposta of apostas) {
            let melhorLinha = { numero: 1, pontos: 0, acertos: 0 };

            // 1. Calcula a pontuação de cada linha
            aposta.palpites.forEach((linha, idxLinha) => {
                let pontos = 0;
                let acertos = 0;

                linha.jogos.forEach((p, idxJogo) => {
                    const pts = this._pontuar(p, resultados[idxJogo]);
                    pontos += pts;
                    if (pts > 0) acertos++;
                });

                // 🔥 Grava os valores em cada linha individualmente
                linha.pontosLinha = Number(pontos);
                linha.acertosLinha = Number(acertos);

                if (pontos > melhorLinha.pontos) {
                    melhorLinha = { numero: idxLinha + 1, pontos, acertos };
                }
            });

            // 2. Atualiza os dados da melhor linha da rodada
            aposta.desempenhoRodada = {
                pontuacaoRodada: melhorLinha.pontos,
                acertosRodada: melhorLinha.acertos,
                melhorLinhaRodada: melhorLinha
            };

            // 3. 🚀 O SEGREDO: Avisa o Mongoose que o array de palpites foi alterado
            aposta.markModified('palpites');
            aposta.markModified('desempenhoRodada');

            // 4. Salva a aposta atualizada
            await aposta.save();

            // 5. Alimenta o array do ranking que será exibido
            rankingData.push({
                usuarioId: aposta.usuario._id,
                apelido: aposta.usuario.apelido,
                timeCoracao: aposta.usuario.timeCoracao,
                melhorLinha,
                createdAt: aposta.createdAt
            });
        }
        rankingData.sort((a, b) => b.melhorLinha.pontos - a.melhorLinha.pontos || a.createdAt - b.createdAt);

        let posicaoAtual = 1;
        let ultimaPontuacao = null;
        rankingData.forEach(r => {
            if (ultimaPontuacao !== null && r.melhorLinha.pontos < ultimaPontuacao) {
                posicaoAtual++;
            }
            r.posicao = posicaoAtual;
            ultimaPontuacao = r.melhorLinha.pontos;
        });

        await RankingRodada.findOneAndUpdate(
            { rodadaId },
            {
                rodadaId,
                rodadaNome: rodada.nome,
                numero: rodada.numero,
                status: rodada.status,
                participantes: rankingData.length,
                ranking: rankingData,
                atualizadoEm: new Date()
            },
            { upsert: true }
        );

        return rankingData;
    }

    async atualizarRankingGeral() {
    console.log("🚀 Iniciando recalculo TOTAL do Ranking Geral...");
    
    // 1. Busca todas as rodadas para ter os placares reais
    const rodadas = await Rodada.find({}).lean();
    const mapaRodadas = {};
    rodadas.forEach(r => { 
        mapaRodadas[r._id.toString()] = r.jogos; 
    });

    // 2. Busca todas as apostas válidas
    const apostas = await Aposta.find({
        status: { $in: ["ativa", "paga", "finalizada", "brinde", "campeao"] }
    }).populate("usuario", "apelido timeCoracao");

    const acumulado = {};

    for (const a of apostas) {
        if (!a.usuario || !a.usuario._id) continue;
        const userId = a.usuario._id.toString();
        const jogosReais = mapaRodadas[a.rodada?.toString()];

        if (!jogosReais) continue;

        if (!acumulado[userId]) {
            acumulado[userId] = {
                usuarioId: userId,
                apelido: a.usuario.apelido,
                timeCoracao: a.usuario.timeCoracao,
                totalPontos: 0,
                rodadasSet: new Set()
            };
        }

        // 🚀 SOMA TODAS AS LINHAS DA CARTELA (FORÇA BRUTA)
        let pontosDestaCartela = 0;
        if (a.palpites && a.palpites.length > 0) {
            a.palpites.forEach(linha => {
                linha.jogos.forEach((palpite, idx) => {
                    const jogoReal = jogosReais[idx];
                    if (jogoReal && jogoReal.placarMandante != null) {
                        pontosDestaCartela += this._pontuar(palpite, jogoReal);
                    }
                });
            });
        }

        acumulado[userId].totalPontos += pontosDestaCartela;
        if (a.rodada) acumulado[userId].rodadasSet.add(a.rodada.toString());
    }

    // 3. Formata e Ordena
    const ranking = Object.values(acumulado)
        .map(user => ({
            usuarioId: user.usuarioId,
            apelido: user.apelido,
            timeCoracao: user.timeCoracao,
            totalPontos: user.totalPontos,
            totalApostas: user.rodadasSet.size
        }))
        .sort((a, b) => b.totalPontos - a.totalPontos)
        .map((user, index) => ({ ...user, posicao: index + 1 }));

    if (ranking.length > 0) {
        await RankingGeral.deleteMany({});
        await RankingGeral.insertMany(ranking);
    }

    console.log(`✅ Ranking Geral atualizado. Líder: ${ranking[0]?.apelido} com ${ranking[0]?.totalPontos} pts.`);
    return ranking;
}


    async atualizarRankingTorcida() {
        const usuarios = await User.find({}, "timeCoracao").lean();
        const contagem = {};
        usuarios.forEach(u => {
            const time = u.timeCoracao?.trim() || "Sem time";
            contagem[time] = (contagem[time] || 0) + 1;
        });
        const total = Object.values(contagem).reduce((a, b) => a + b, 0);
        const dados = Object.entries(contagem).map(([time, qtd]) => ({
            time,
            torcedores: qtd,
            porcentagem: total ? (qtd / total * 100).toFixed(1) : "0.0"
        })).sort((a, b) => b.torcedores - a.torcedores);

        await RankingTorcida.deleteMany({});
        await RankingTorcida.insertMany(dados);
        return dados;
    }

    async atualizarTudo(rodadaId) {
        await this.atualizarRankingRodada(rodadaId);
        await this.atualizarRankingGeral();
        await this.atualizarRankingTorcida();
        await registrarCampeao(rodadaId);
    }
}

module.exports = new RankingService();
