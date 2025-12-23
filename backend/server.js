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
// Ruta temporal para arreglar contadores (eliminar después de usar)
app.get('/api/fix-replies', async (req, res) => {
    const pool = require('./config/database');
    try {
        await pool.query(`
            CREATE OR REPLACE FUNCTION update_replies_count()
            RETURNS TRIGGER AS $$
            BEGIN
                IF TG_OP = 'INSERT' THEN
                    UPDATE posts SET replies_count = replies_count + 1 WHERE id = NEW.post_id;
                    RETURN NEW;
                ELSIF TG_OP = 'DELETE' THEN
                    UPDATE posts SET replies_count = replies_count - 1 WHERE id = OLD.post_id;
                    RETURN OLD;
                ELSIF TG_OP = 'UPDATE' AND OLD.is_deleted = false AND NEW.is_deleted = true THEN
                    UPDATE posts SET replies_count = replies_count - 1 WHERE id = NEW.post_id;
                    RETURN NEW;
                END IF;
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;
        `);
        await pool.query('DROP TRIGGER IF EXISTS trigger_update_replies_count ON replies;');
        await pool.query(`
            CREATE TRIGGER trigger_update_replies_count
            AFTER INSERT OR DELETE OR UPDATE OF is_deleted ON replies
            FOR EACH ROW
            EXECUTE FUNCTION update_replies_count();
        `);
        await pool.query(`
            UPDATE posts SET replies_count = (
                SELECT COUNT(*) FROM replies 
                WHERE replies.post_id = posts.id AND replies.is_deleted = false
            );
        `);
        res.json({ success: true, message: 'Contadores arreglados!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
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
