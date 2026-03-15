// services/RankingService.js — VERSÃO BLINDADA (Compatível com dados antigos e novos)
const Aposta = require('../models/Aposta');
const Rodada = require('../models/Rodada');
const RankingRodada = require('../models/RankingRodada');
const RankingGeral = require('../models/RankingGeral');
const RankingTorcida = require('../models/RankingTorcida');

class RankingService {
    _extrairPlacar(p) {
        if (!p) return null;
        if (typeof p.palpite === "string") {
            const partes = p.palpite.split(/[xX-]/).map(Number);
            return partes.length === 2 ? partes : null;
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
        if (!real || real.placarMandante == null) return { pts: 0, tipo: "erro" };
        const p = this._extrairPlacar(palpite);
        if (!p || p[0] == null || p[1] == null) return { pts: 0, tipo: "erro" };

        const realPlacar = [real.placarMandante, real.placarVisitante];

        if (p[0] === realPlacar[0] && p[1] === realPlacar[1]) return { pts: 5, tipo: "placar" };
        if (this._resultado(p) === this._resultado(realPlacar)) return { pts: 3, tipo: "resultado" };

        return { pts: 0, tipo: "erro" };
    }

    async atualizarRankingRodada(rodadaId) {
        console.log("🚀 Iniciando recalque de ranking para rodada:", rodadaId);
        
        const rodada = await Rodada.findById(rodadaId);
        if (!rodada) throw new Error("Rodada não encontrada");

        const apostas = await Aposta.find({
            rodada: rodadaId,
            status: { $in: ["ativa", "paga", "brinde", "finalizada", "campeao"] }
        }).populate("usuario", "apelido timeCoracao");

        const resultados = rodada.jogos;
        const rankingData = [];

        for (const aposta of apostas) {
            let melhorLinha = { numero: 1, pontos: 0, acertos: { placar: 0, resultado: 0, erro: 0 } };

            if (aposta.palpites && Array.isArray(aposta.palpites)) {
                aposta.palpites.forEach((linha, idxLinha) => {
                    let pontos = 0;
                    let acertosObj = { placar: 0, resultado: 0, erro: 0 };

                    if (linha.jogos && Array.isArray(linha.jogos)) {
                        linha.jogos.forEach((p, idxJogo) => {
                            const res = this._pontuar(p, resultados[idxJogo]);
                            pontos += res.pts;
                            acertosObj[res.tipo]++;
                        });
                    }

                    linha.pontosLinha = pontos;
                    linha.acertosDetalhado = acertosObj;

                    if (pontos >= melhorLinha.pontos) {
                        melhorLinha = { numero: idxLinha + 1, pontos, acertos: acertosObj };
                    }
                });
            }

            // Salva a atualização no banco convertendo o formato antigo para o novo
            await Aposta.updateOne(
                { _id: aposta._id },
                { $set: { 
                    palpites: aposta.palpites,
                    desempenhoRodada: {
                        pontuacaoRodada: melhorLinha.pontos,
                        acertosRodada: melhorLinha.acertos, // Aqui salva como OBJETO agora
                        melhorLinhaRodada: melhorLinha
                    }
                }}
            );

            rankingData.push({
                usuarioId: aposta.usuario?._id,
                apelido: aposta.usuario?.apelido || "Usuário",
                timeCoracao: aposta.usuario?.timeCoracao || "Sem time",
                melhorLinha,
                createdAt: aposta.createdAt
            });
        }

        rankingData.sort((a, b) => b.melhorLinha.pontos - a.melhorLinha.pontos || a.createdAt - b.createdAt);

        let posicaoAtual = 1;
        let ultimaPontuacao = null;
        rankingData.forEach(r => {
            if (ultimaPontuacao !== null && r.melhorLinha.pontos < ultimaPontuacao) posicaoAtual++;
            r.posicao = posicaoAtual;
            ultimaPontuacao = r.melhorLinha.pontos;
        });

        await RankingRodada.findOneAndUpdate(
            { rodadaId },
            { 
                rodadaId, 
                rodadaNome: rodada.nome, 
                participantes: rankingData.length, 
                ranking: rankingData, 
                atualizadoEm: new Date() 
            },
            { upsert: true }
        );

        return rankingData;
    }
}

module.exports = new RankingService();
