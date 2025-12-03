const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

console.log("🚀 WEBHOOK LIDO PELO SERVIDOR:", process.env.MP_WEBHOOK_URL);
console.log("🚀 ACCESS TOKEN:", process.env.MP_ACCESS_TOKEN);

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Servir frontend
const frontendPath = path.join(__dirname, '../frontend');
const publicPath = path.join(__dirname, 'public');

if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    console.log('✅ Frontend servido de:', frontendPath);
} else if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
    console.log('✅ Frontend servido de:', publicPath);
} else {
    console.log('⚠️  Pasta do frontend não encontrada');
}

// MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/club_bolao', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ Conectado ao MongoDB'))
.catch(err => console.error('❌ Erro ao conectar MongoDB:', err));

// Rotas
app.use("/api/pagamento", require("./routes/pagamento"));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/rodadas', require('./routes/rodadas'));
app.use('/api/apostas', require('./routes/apostas'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/financeiro', require('./routes/financeiro'));
app.use('/api/usuario', require('./routes/users'));
app.use('/api/ranking', require('./routes/ranking'));
app.use("/api/campeoes", require("./routes/campeoes"));
app.use("/api/premios", require("./routes/premios"));
app.use("/api/admin/premios", require("./routes/adminPremios"));
app.use("/api/preapostas", require("./routes/preapostas"));

// Teste
app.get('/api/test', (req, res) => {
    res.json({ message: 'Backend do Club do Bolão funcionando!' });
});

// Frontend fallback
app.get(/^((?!\/api).)*$/, (req, res) => {
    const possiblePaths = [
        path.join(__dirname, '../frontend/index.html'),
        path.join(__dirname, 'public/index.html'),
        path.join(__dirname, '../index.html')
    ];

    for (const indexPath of possiblePaths) {
        if (fs.existsSync(indexPath)) {
            return res.sendFile(indexPath);
        }
    }

    res.status(404).json({ error: 'Frontend não encontrado' });
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
