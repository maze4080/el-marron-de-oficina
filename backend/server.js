/**
 * EL MARRÓN DE OFICINA - Backend Server
 * =====================================
 * API REST para el foro anónimo de oficinas peruanas
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

// ===========================================
// MIDDLEWARES DE SEGURIDAD
// ===========================================

// Helmet para headers de seguridad
app.use(helmet());

// CORS
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting general
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
        success: false,
        message: 'Demasiadas solicitudes, intenta de nuevo más tarde'
    },
    standardHeaders: true,
    legacyHeaders: false
});
app.use(limiter);

// Rate limiting más estricto para autenticación
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // máximo 10 intentos por IP
    message: {
        success: false,
        message: 'Demasiados intentos de autenticación, intenta en 15 minutos'
    }
});

// ===========================================
// MIDDLEWARES DE PARSING
// ===========================================

app.use(express.json({ limit: '10kb' })); // Limitar tamaño de body
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ===========================================
// LOGGING (desarrollo)
// ===========================================

if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
        next();
    });
}

// ===========================================
// RUTAS DE LA API
// ===========================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'El Marrón de Oficina API está funcionando ☕',
        timestamp: new Date().toISOString()
    });
});

// Rutas de autenticación (con rate limiting adicional)
app.use('/api/auth', authLimiter, authRoutes);

// Rutas de posts
app.use('/api/posts', postsRoutes);

// ===========================================
// MANEJO DE ERRORES
// ===========================================

// Ruta no encontrada
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint no encontrado'
    });
});

// Error handler global
app.use((err, req, res, next) => {
    console.error('Error no manejado:', err);
    
    // No revelar detalles en producción
    const message = process.env.NODE_ENV === 'production' 
        ? 'Error interno del servidor' 
        : err.message;

    res.status(err.status || 500).json({
        success: false,
        message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// ===========================================
// INICIAR SERVIDOR
// ===========================================

app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('   ☕ EL MARRÓN DE OFICINA - Backend API');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   🚀 Servidor corriendo en: http://localhost:${PORT}`);
    console.log(`   📡 API disponible en: http://localhost:${PORT}/api`);
    console.log(`   🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
});

module.exports = app;
