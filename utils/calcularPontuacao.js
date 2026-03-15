// utils/calcularPontuacao.js — VERSÃO FINAL COM DETALHAMENTO DE ACERTOS
//--------------------------------------------------
const Aposta = require("../models/Aposta");
const Rodada = require("../models/Rodada");
const { atualizarEstatisticasUsuario } = require("./estatisticas");

//--------------------------------------------------
// Função auxiliar — calcula pontos e identifica o tipo de acerto
//--------------------------------------------------
function calcularPontosDoJogo(palpiteObj, jogoReal) {
  // Se o jogo não tem placar definido → erro
  if (!jogoReal || jogoReal.placarMandante == null || jogoReal.placarVisitante == null) {
    return { pontos: 0, tipo: "erro" };
  }

  let mandante, visitante;

  // Interpretar palpite (string "2x1" ou campos numéricos)
  if (palpiteObj.palpite && typeof palpiteObj.palpite === "string") {
    const partes = palpiteObj.palpite.replace(/\s+/g, "").split(/[xX-]/);
    mandante = Number(partes[0]);
    visitante = Number(partes[1]);
  } else {
    mandante = palpiteObj.palpiteMandante ?? null;
    visitante = palpiteObj.palpiteVisitante ?? null;
  }

  if (mandante == null || visitante == null) {
    return { pontos: 0, tipo: "erro" };
  }

  // 1. Placar exato → 5 pts (Tipo: placar -> 🏆)
  if (mandante === jogoReal.placarMandante && visitante === jogoReal.placarVisitante) {
    return { pontos: 5, tipo: "placar" };
  }

  // 2. Resultado correto (vitória/empate/derrota) → 3 pts (Tipo: resultado -> ⚽)
  const resultadoPalpite = mandante > visitante ? "C" : mandante < visitante ? "F" : "E";
  const resultadoReal = jogoReal.placarMandante > jogoReal.placarVisitante ? "C" : jogoReal.placarMandante < jogoReal.placarVisitante ? "F" : "E";

  if (resultadoPalpite === resultadoReal) {
    return { pontos: 3, tipo: "resultado" };
  }

  // 3. Erro total → 0 pts (Tipo: erro -> ❌)
  return { pontos: 0, tipo: "erro" };
}

//--------------------------------------------------
// 📊 FUNÇÃO PRINCIPAL — CALCULAR A RODADA
//--------------------------------------------------
async function calcularPontuacaoRodada(rodadaId) {
  console.log(`📊 Calculando pontuação detalhada da rodada ${rodadaId}...`);

  const rodada = await Rodada.findById(rodadaId);
  if (!rodada) throw new Error("Rodada não encontrada");

  const apostas = await Aposta.find({
    rodada: rodadaId,
    status: { $in: ["paga", "brinde", "ativa", "campeao", "finalizada"] }
  });

  if (!apostas.length) return { sucesso: true, totalAtualizadas: 0 };

  let totalAtualizadas = 0;

  for (const aposta of apostas) {
    let melhorLinha = { numero: 1, pontos: 0, acertos: { placar: 0, resultado: 0, erro: 0 } };

    aposta.palpites.forEach((linha, indexLinha) => {
      let pontosLinha = 0;
      let detalhesAcertos = { placar: 0, resultado: 0, erro: 0 };

      linha.jogos.forEach((palpiteObj, idxJogo) => {
        const jogoReal = rodada.jogos[idxJogo];
        const resultado = calcularPontosDoJogo(palpiteObj, jogoReal);

        // Salvar metadados no palpite
        palpiteObj.pontos = resultado.pontos;
        palpiteObj.tipoAcerto = resultado.tipo;

        pontosLinha += resultado.pontos;
        detalhesAcertos[resultado.tipo]++;
      });

      linha.pontosLinha = pontosLinha;
      linha.acertosDetalhado = detalhesAcertos;

      // Critério de melhor linha: maior pontuação
      if (pontosLinha > melhorLinha.pontos) {
        melhorLinha = {
          numero: indexLinha + 1,
          pontos: pontosLinha,
          acertos: detalhesAcertos
        };
      }
    });

    aposta.desempenhoRodada = {
      pontuacaoRodada: melhorLinha.pontos,
      acertosRodada: melhorLinha.acertos, // Agora é um objeto {placar, resultado, erro}
      melhorLinhaRodada: melhorLinha
    };

    await aposta.save();
    if (aposta.usuario) await atualizarEstatisticasUsuario(aposta.usuario);
    totalAtualizadas++;
  }

  return { sucesso: true, totalAtualizadas };
}

module.exports = { calcularPontuacaoRodada };
