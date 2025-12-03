const Aposta = require("../models/Aposta");
const Rodada = require("../models/Rodada");
const Campeao = require("../models/Campeao");
const RankingGeral = require("../models/RankingGeral");
const User = require("../models/User");
const { atualizarEstatisticasUsuario } = require("./estatisticas");

async function calcularPontuacaoRodada(rodadaId) {
  console.log(`📊 Recalculando pontuação da rodada ${rodadaId}...`);

  const rodada = await Rodada.findById(rodadaId);
  if (!rodada) throw new Error("Rodada não encontrada");

  const apostas = await Aposta.find({
    rodada: rodadaId,
    status: { $in: ["paga", "brinde", "finalizada", "campeao"] },

  });

  if (!apostas.length)
    return { message: "Nenhuma aposta válida para pontuação" };

  let totalAtualizadas = 0;

  // 🔄 Calcula linha por linha das apostas
  for (const aposta of apostas) {
    let totalPontos = 0;
    let totalAcertos = 0;
    let melhorLinha = { numero: 1, pontos: 0, acertos: 0 };

    aposta.palpites.forEach((linha, linhaIndex) => {
      let pontosLinha = 0;
      let acertosLinha = 0;

      linha.jogos.forEach((palpiteObj, jogoIndex) => {
        const jogoReal = rodada.jogos[jogoIndex];
        const resultado = calcularPontos(palpiteObj, jogoReal);

        palpiteObj.pontos = resultado.pontos;
        palpiteObj.acertou = resultado.acertou;

        pontosLinha += resultado.pontos;
        if (resultado.acertou) acertosLinha++;
      });

      linha.pontosLinha = pontosLinha;
      linha.acertosLinha = acertosLinha;

      totalPontos += pontosLinha;
      totalAcertos += acertosLinha;

      // Atualiza a melhor linha
      if (pontosLinha > melhorLinha.pontos) {
        melhorLinha = {
          numero: linhaIndex + 1,
          pontos: pontosLinha,
          acertos: acertosLinha,
        };
      }
    });

    aposta.pontuacao = totalPontos;
    aposta.acertos = totalAcertos;
    aposta.melhorLinha = melhorLinha;
    aposta.desempenhoRodada = {
      pontuacaoRodada: melhorLinha.pontos,
      acertosRodada: melhorLinha.acertos,
      melhorLinhaRodada: melhorLinha,
    };

    await aposta.save();
    await atualizarEstatisticasUsuario(aposta.usuario);
    totalAtualizadas++;
  }

  // 🏆 Identifica os campeões empatados
  const maiorPontuacao = await Aposta.findOne({ rodada: rodadaId })
    .sort({ "melhorLinha.pontos": -1 })
    .select("melhorLinha.pontos");

  if (!maiorPontuacao)
    return { message: "Nenhuma pontuação encontrada para definir campeão." };

  const campeoes = await Aposta.find({
    rodada: rodadaId,
    "melhorLinha.pontos": maiorPontuacao.melhorLinha.pontos,
  }).populate("usuario", "apelido");

  if (campeoes.length) {
    // 🔄 Limpa status antigos
    await Aposta.updateMany(
      { rodada: rodadaId },
      { $set: { status: "paga", campeaoRodada: false } }
    );

    // 🏅 Marca campeões empatados
    for (const apostaCampea of campeoes) {
      apostaCampea.status = "campeao";
      apostaCampea.campeaoRodada = true;
      await apostaCampea.save();

      // 💾 Atualiza ou cria registro no modelo Campeao
      await Campeao.updateOne(
        { rodada: rodadaId, usuario: apostaCampea.usuario._id },
        {
          $set: {
            aposta: apostaCampea._id,
            pontuacao: apostaCampea.melhorLinha.pontos,
            acertos: apostaCampea.melhorLinha.acertos,
            linhaVencedora: apostaCampea.melhorLinha.numero,
            dataPremiacao: new Date(),
            statusPremio: "pendente",
          },
        },
        { upsert: true }
      );

      // 🧮 Atualiza ranking geral (incremental)
      await RankingGeral.updateOne(
        { usuario: apostaCampea.usuario._id },
        {
          $inc: {
            pontosTotais: apostaCampea.melhorLinha.pontos,
            rodadasJogadas: 1,
          },
          $setOnInsert: { apelido: apostaCampea.usuario.apelido },
        },
        { upsert: true }
      );

      // 💾 Atualiza o campo no modelo de usuário
      await User.updateOne(
        { _id: apostaCampea.usuario._id },
        {
          $inc: {
            pontuacaoGeral: apostaCampea.melhorLinha.pontos,
            "estatisticas.pontuacaoTotal": apostaCampea.melhorLinha.pontos,
            "estatisticas.rodadasParticipadas": 1,
          },
        }
      );

      console.log(
        `🏆 Campeão: ${apostaCampea.usuario.apelido} (${apostaCampea.melhorLinha.pontos} pts)`
      );
    }

    rodada.status = "finalizada";
    rodada.campeoesRodada = campeoes.map(c => ({
      usuario: c.usuario._id,
      apelido: c.usuario.apelido,
      pontos: c.melhorLinha.pontos,
      acertos: c.melhorLinha.acertos,
    }));
    await rodada.save();
  } else {
    console.warn("⚠️ Nenhum campeão encontrado (todas as apostas zeradas?)");
  }

  console.log(`✅ ${totalAtualizadas} apostas pontuadas na rodada ${rodada.nome}`);

  return {
    message: `Pontuação recalculada. ${campeoes.length} campeão(ões) definido(s).`,
    rodada: rodada.nome,
    campeoes: campeoes.map(c => c.usuario.apelido),
  };
}

// 🧮 Função auxiliar
function calcularPontos(palpiteObj, jogoReal) {
  if (!jogoReal || jogoReal.placarMandante == null || jogoReal.placarVisitante == null)
    return { pontos: 0, acertou: false };

  let golsMandante, golsVisitante;

  if (palpiteObj.palpite && typeof palpiteObj.palpite === "string") {
    [golsMandante, golsVisitante] = palpiteObj.palpite.split("x").map(Number);
  } else {
    golsMandante = palpiteObj.palpiteMandante;
    golsVisitante = palpiteObj.palpiteVisitante;
  }

  if (golsMandante == null || golsVisitante == null)
    return { pontos: 0, acertou: false };

  // Placar exato = 5 pontos
  if (
    golsMandante === jogoReal.placarMandante &&
    golsVisitante === jogoReal.placarVisitante
  )
    return { pontos: 5, acertou: true };

  // Resultado correto = 3 pontos
  const resultadoPalpite =
    golsMandante > golsVisitante ? "C" :
      golsMandante < golsVisitante ? "F" : "E";

  const resultadoReal =
    jogoReal.placarMandante > jogoReal.placarVisitante ? "C" :
      jogoReal.placarMandante < jogoReal.placarVisitante ? "F" : "E";

  return {
    pontos: resultadoPalpite === resultadoReal ? 3 : 0,
    acertou: resultadoPalpite === resultadoReal,
  };
}

module.exports = { calcularPontuacaoRodada };
