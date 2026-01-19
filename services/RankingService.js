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
       🏁 RANKING DA RODADA
       ====================================================== */
    async atualizarRankingRodada(rodadaId) {

        const rodada = await Rodada.findById(rodadaId);
        if (!rodada) throw new Error("Rodada não encontrada");

        const apostas = await Aposta.find({
            rodada: rodadaId,
            status: { $in: ["ativa", "paga", "brinde", "finalizada", "campeao"] }
        })
            .populate("usuario", "apelido timeCoracao");

        const resultados = rodada.jogos;
        const rankingData = [];

        for (const aposta of apostas) {

            let melhorLinha = { numero: 1, pontos: 0, acertos: 0 };

            aposta.palpites.forEach((linha, idxLinha) => {
                let pontos = 0;
                let acertos = 0;

                linha.jogos.forEach((p, idxJogo) => {
                    const pts = this._pontuar(p, resultados[idxJogo]);
                    pontos += pts;
                    if (pts > 0) acertos++;
                });

                linha.pontosLinha = pontos;
                linha.acertos = acertos;

                if (pontos > melhorLinha.pontos) {
                    melhorLinha = {
                        numero: idxLinha + 1,
                        pontos,
                        acertos
                    };
                }
            });

            // Salva pontos calculados
            await Aposta.updateOne(
                { _id: aposta._id },
                {
                    $set: {
                        palpites: aposta.palpites,
                        desempenhoRodada: {
                            pontuacaoRodada: melhorLinha.pontos,
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

        rankingData.sort((a, b) =>
            b.melhorLinha.pontos - a.melhorLinha.pontos ||
            a.createdAt - b.createdAt
        );

        let ultimaPontuacao = null;
        let ultimaPosicao = 0;

        rankingData.forEach((r, index) => {
            if (r.melhorLinha.pontos !== ultimaPontuacao) {
                ultimaPosicao = index + 1;
            }

            r.posicao = ultimaPosicao;
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

    /* ======================================================
       🏆 RANKING GERAL — soma todas as linhas
       ====================================================== */
    async atualizarRankingGeral() {

        const apostas = await Aposta.find({
            status: { $in: ["ativa", "paga", "finalizada", "brinde", "campeao"] }
        }).populate("usuario", "apelido timeCoracao");

        const acumulado = {};

        for (const a of apostas) {

            const id = a.usuario?._id?.toString();
            if (!id) continue;

            if (!acumulado[id]) {
                acumulado[id] = {
                    usuarioId: id,
                    apelido: a.usuario.apelido,
                    timeCoracao: a.usuario.timeCoracao,
                    totalPontos: 0,
                    totalApostas: 0
                };
            }

            const somaCartela = (a.palpites || []).reduce(
                (soma, linha) => soma + (linha.pontosLinha || 0),
                0
            );

            acumulado[id].totalPontos += somaCartela;
            acumulado[id].totalApostas++;
        }

        const ranking = Object.values(acumulado)
            .sort((a, b) => b.totalPontos - a.totalPontos)
            .map((r, i) => ({ ...r, posicao: i + 1 }));

        await RankingGeral.deleteMany({});
        await RankingGeral.insertMany(ranking);

        return ranking;
    }

    /* ======================================================
       ⚽ TORCIDAS
       ====================================================== */
    async atualizarRankingTorcida() {
        const usuarios = await User.find({}, "timeCoracao").lean();
        const contagem = {};

        usuarios.forEach(u => {
            const time = u.timeCoracao?.trim() || "Sem time";
            if (!contagem[time]) contagem[time] = 0;
            contagem[time]++;
        });

        const total = Object.values(contagem).reduce((a, b) => a + b, 0);

        const dados = Object.entries(contagem)
            .map(([time, qtd]) => ({
                time,
                torcedores: qtd,
                porcentagem: total ? (qtd / total * 100).toFixed(1) : "0.0"
            }))
            .sort((a, b) => b.torcedores - a.torcedores);

        await RankingTorcida.deleteMany({});
        await RankingTorcida.insertMany(dados);

        return dados;
    }

    /* ======================================================
       🚀 EXECUTA TUDO E REGISTRA CAMPEÃO
       ====================================================== */
    async atualizarTudo(rodadaId) {
        await this.atualizarRankingRodada(rodadaId);
        await this.atualizarRankingGeral();
        await this.atualizarRankingTorcida();

        // ⭐ AGORA SIM: registra campeão com dados CORRETOS
        await registrarCampeao(rodadaId);
    }
}

module.exports = new RankingService();
