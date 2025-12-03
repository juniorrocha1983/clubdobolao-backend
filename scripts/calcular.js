/**
 * 🧮 Recalcular Pontuação de uma Rodada
 * Executa manualmente o cálculo de pontuação das apostas
 * de uma rodada já finalizada (com placares definidos).
 *
 * ▶️ Execute com:  node scripts/calcular.js
 */

const mongoose = require("mongoose");
const { calcularPontuacaoRodada } = require("../utils/calcularPontuacao");

// 🏁 ID da rodada que você quer recalcular
const RODADA_ID = "690b524995961ec6cc01c714";

// ⚙️ URI do seu MongoDB local (troque o nome do banco se for outro)
const MONGO_URI = "mongodb://localhost:27017/club_bolao";

(async () => {
  try {
    console.log("🚀 Conectando ao MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Conectado!");
    console.log(`📊 Recalculando pontuação da rodada ${RODADA_ID}...\n`);

    const result = await calcularPontuacaoRodada(RODADA_ID); // retorna um objeto com mensagem
    console.log(result?.message || "✅ Pontuação recalculada!"); // exibe mensagem do util

  } catch (err) {
    console.error("❌ Erro ao calcular pontuação:", err);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Conexão encerrada.");
  }
})();
