const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Corrigido: usar MONGO_URI (nome real da variável no Railway)
        const mongoUri = process.env.MONGO_URI;

        if (!mongoUri) {
            throw new Error("❌ ERRO: Variável MONGO_URI não encontrada no ambiente!");
        }

        const conn = await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log(`✅ MongoDB Conectado: ${conn.connection.host}`);
    } catch (error) {
        console.error('❌ Erro ao conectar MongoDB:', error);
        process.exit(1);
    }
};

module.exports = connectDB;
