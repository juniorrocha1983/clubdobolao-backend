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

    /* ======================================================
       🏁 RANKING DA RODADA (MANTÉM MELHOR LINHA)
    ====================================================== */
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
            let somaTotalCartela = 0; // 🔥 Soma de todas as linhas

            aposta.palpites.forEach((linha, idxLinha) => {
                let pontosLinha = 0;
                let acertosLinha = 0;

                linha.jogos.forEach((p, idxJogo) => {
                    const pts = this._pontuar(p, resultados[idxJogo]);
                    pontosLinha += pts;
                    if (pts > 0) acertosLinha++;
                });

                linha.pontosLinha = pontosLinha;
                linha.acertos = acertosLinha;
                
                somaTotalCartela += pontosLinha; // Acumula tudo

                if (pontosLinha > melhorLinha.pontos) {
                    melhorLinha = { numero: idxLinha + 1, pontos: pontosLinha, acertos: acertosLinha };
                }
            });

            await Aposta.updateOne(
                { _id: aposta._id },
                {
                    $set: {
                        palpites: aposta.palpites,
                        desempenhoRodada: {
                            pontuacaoRodada: melhorLinha.pontos, // Ranking Rodada (Melhor Linha)
                            pontuacaoTotalCartela: somaTotalCartela, // 🔥 Ranking Geral (Soma Tudo)
                            acertosRodada: melhorLinha.acertos,
                            melhorLinhaRodada: melhorLinha
                        }
                    }
                }
            );

            rankingData.push({
                usuarioId: aposta.usuario._id,
                apelido: aposta.usuario.apelido,
                timeCoracao: aposta.usuario.timeCoracao,
                melhorLinha,
                createdAt: aposta.createdAt
            });
        }

        rankingData.sort((a, b) => b.melhorLinha.pontos - a.melhorLinha.pontos || a.createdAt - b.createdAt);
        let pos = 1, lastPts = null;
        rankingData.forEach(r => {
            if (lastPts !== null && r.melhorLinha.pontos < lastPts) pos++;
            r.posicao = pos;
            lastPts = r.melhorLinha.pontos;
        });

        await RankingRodada.findOneAndUpdate({ rodadaId }, {
            rodadaId, rodadaNome: rodada.nome, numero: rodada.numero, status: rodada.status,
            participantes: rankingData.length, ranking: rankingData, atualizadoEm: new Date()
        }, { upsert: true });

        return rankingData;
    }

    /* ======================================================
       🏆 RANKING GERAL (SOMA DAS CARTELAS COMPLETAS)
    ====================================================== */
    async atualizarRankingGeral() {
        const apostas = await Aposta.find({
            status: { $in: ["ativa", "paga", "finalizada", "brinde", "campeao"] }
        }).populate("usuario", "apelido timeCoracao");

        const acumulado = {};

        for (const a of apostas) {
            if (!a.usuario) continue;
            const userId = a.usuario._id.toString();

            if (!acumulado[userId]) {
                acumulado[userId] = {
                    usuarioId: userId, apelido: a.usuario.apelido,
                    timeCoracao: a.usuario.timeCoracao, totalPontos: 0, rodadasSet: new Set()
                };
            }

            // 🔥 AQUI ESTÁ A MUDANÇA: Usamos a soma total da cartela
            let pontosDaAposta = 0;
            if (a.desempenhoRodada && a.desempenhoRodada.pontuacaoTotalCartela !== undefined) {
                pontosDaAposta = Number(a.desempenhoRodada.pontuacaoTotalCartela);
            } else {
                // Caso o campo não exista ainda, somamos as linhas agora
                pontosDaAposta = a.palpites.reduce((acc, l) => acc + (l.pontosLinha || 0), 0);
            }

            acumulado[userId].totalPoints += pontosDaAposta;
            if (a.rodada) acumulado[userId].rodadasSet.add(a.rodada.toString());
        }

        const ranking = Object.values(acumulado)
            .map(u => ({
                usuarioId: u.usuarioId, apelido: u.apelido, timeCoracao: u.timeCoracao,
                totalPontos: u.totalPoints || 0, totalApostas: u.rodadasSet.size
            }))
            .sort((a, b) => b.totalPontos - a.totalPontos)
            .map((u, i) => ({ ...u, posicao: i + 1 }));

        await RankingGeral.deleteMany({});
        if (ranking.length > 0) await RankingGeral.insertMany(ranking);
        return ranking;
    }

    async atualizarRankingTorcida() {
        const usuarios = await User.find({}, "timeCoracao").lean();
        const contagem = {};
        usuarios.forEach(u => { const t = u.timeCoracao?.trim() || "Sem time"; contagem[t] = (contagem[t] || 0) + 1; });
        const total = Object.values(contagem).reduce((a, b) => a + b, 0);
        const dados = Object.entries(contagem).map(([time, qtd]) => ({
            time, torcedores: qtd, porcentagem: total ? (qtd / total * 100).toFixed(1) : "0.0"
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
