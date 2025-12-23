/**
 * EL MARRÓN DE OFICINA - Backend Server
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Importar rutas
const authRoutes = require('./routes/auth');
const postsRoutes = require('./routes/posts');

// Crear aplicación Express
const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (necesario para Railway)
app.set('trust proxy', 1);

// Helmet para headers de seguridad
app.use(helmet());

// CORS
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting general
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        message: 'Demasiadas solicitudes, intenta de nuevo más tarde'
    },
    standardHeaders: true,
    legacyHeaders: false
});
app.use(limiter);

// Rate limiting para autenticación
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        message: 'Demasiados intentos de autenticación, intenta en 15 minutos'
    }
});

// Middlewares de parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
    next();
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'El Marrón de Oficina API está funcionando ☕',
        timestamp: new Date().toISOString()
    });
});

// Rutas
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/posts', postsRoutes);

// Ruta no encontrada
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint no encontrado'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: 'Error interno del servidor'
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('   ☕ EL MARRÓN DE OFICINA - Backend API');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   🚀 Servidor corriendo en puerto: ${PORT}`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
});

module.exports = app;
