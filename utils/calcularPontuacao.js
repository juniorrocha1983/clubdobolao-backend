// utils/calcularPontuacao.js — VERSÃO FINAL
//--------------------------------------------------
// Função responsável SOMENTE por calcular a pontuação
// da rodada e salvar na aposta. NÃO decide campeão,
// NÃO altera status, NÃO interfere no ranking.
//--------------------------------------------------

const Aposta = require("../models/Aposta");
const Rodada = require("../models/Rodada");
const { atualizarEstatisticasUsuario } = require("./estatisticas");

//--------------------------------------------------
// Função auxiliar — calcula pontos de um palpite
//--------------------------------------------------
function calcularPontosDoJogo(palpiteObj, jogoReal) {
  // Se o jogo não tem placar definido → zero
  if (!jogoReal || jogoReal.placarMandante == null || jogoReal.placarVisitante == null) {
    return { pontos: 0, acertou: false };
  }

  // Interpretar palpite
  let mandante, visitante;

  // Caso o palpite seja string “2x1”
  if (palpiteObj.palpite && typeof palpiteObj.palpite === "string") {
    const partes = palpiteObj.palpite.replace(/\s+/g, "").split(/[xX-]/);
    mandante = Number(partes[0]);
    visitante = Number(partes[1]);
  } else {
    mandante = palpiteObj.palpiteMandante ?? null;
    visitante = palpiteObj.palpiteVisitante ?? null;
  }

  if (mandante == null || visitante == null) {
    return { pontos: 0, acertou: false };
  }

  // Placar exato → 5 pts
  if (
    mandante === jogoReal.placarMandante &&
    visitante === jogoReal.placarVisitante
  ) {
    return { pontos: 5, acertou: true };
  }

  // Resultado correto (vitória/empate/derrota) → 3 pts
  const resultadoPalpite =
    mandante > visitante ? "C" :
    mandante < visitante ? "F" : "E";

  const resultadoReal =
    jogoReal.placarMandante > jogoReal.placarVisitante ? "C" :
    jogoReal.placarMandante < jogoReal.placarVisitante ? "F" : "E";

  if (resultadoPalpite === resultadoReal) {
    return { pontos: 3, acertou: true };
  }

  return { pontos: 0, acertou: false };
}


//--------------------------------------------------
// 📊 FUNÇÃO PRINCIPAL — CALCULAR A RODADA
//--------------------------------------------------
async function calcularPontuacaoRodada(rodadaId) {
  console.log(`📊 Calculando pontuação da rodada ${rodadaId}...`);

  const rodada = await Rodada.findById(rodadaId);
  if (!rodada) throw new Error("Rodada não encontrada");

  const apostas = await Aposta.find({
    rodada: rodadaId,
    status: { $in: ["paga", "brinde", "ativa", "campeao", "finalizada"] }
  });

  if (!apostas.length) {
    console.log("⚠ Nenhuma aposta válida para calcular.");
    return;
  }

  let totalAtualizadas = 0;

  //--------------------------------------------------
  // PROCESSAR CADA APOSTA
  //--------------------------------------------------
  for (const aposta of apostas) {

    let melhorLinha = { numero: 1, pontos: 0, acertos: 0 };

    aposta.palpites.forEach((linha, indexLinha) => {
      let pontosLinha = 0;
      let acertosLinha = 0;

      linha.jogos.forEach((palpiteObj, idxJogo) => {
        const jogoReal = rodada.jogos[idxJogo];
        const resultado = calcularPontosDoJogo(palpiteObj, jogoReal);

        // Salvar para depuração futura (não usado no ranking)
       palpiteObj.pontos = resultado.pontos;

             if (resultado.pontos === 5) {
               palpiteObj.tipoAcerto = "trofeu";
               } else if (resultado.pontos === 3) {
               palpiteObj.tipoAcerto = "bola";
                   } else {
                           palpiteObj.tipoAcerto = "erro";
    }

        pontosLinha += resultado.pontos;
        if (resultado.acertou) acertosLinha++;
      });

      // Guarda meta de linha
      linha.pontosLinha = pontosLinha;
      linha.acertosLinha = acertosLinha;

      // Atualiza melhor linha
      if (pontosLinha > melhorLinha.pontos) {
        melhorLinha = {
          numero: indexLinha + 1,
          pontos: pontosLinha,
          acertos: acertosLinha
        };
      }
    });

    //--------------------------------------------------
    // Gravar na aposta — APENAS dados de rodada
    //--------------------------------------------------
    aposta.desempenhoRodada = {
      pontuacaoRodada: melhorLinha.pontos,
      acertosRodada: melhorLinha.acertos,
      melhorLinhaRodada: melhorLinha
    };

    // NÃO ALTERAR STATUS AQUI!!!

    await aposta.save();
  
    totalAtualizadas++;
  }

  console.log(`✅ ${totalAtualizadas} apostas atualizadas com pontuação da rodada.`);

  return {
    sucesso: true,
    totalAtualizadas
  };
}

module.exports = { calcularPontuacaoRodada };
