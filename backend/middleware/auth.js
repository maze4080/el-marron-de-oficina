/**
 * Middleware de Autenticación JWT
 */
const jwt = require('jsonwebtoken');
const db = require('../config/database');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * Generar token JWT
 */
const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user.id, 
            uuid: user.uuid,
            username: user.username 
        },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

/**
 * Verificar token y obtener usuario
 */
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
};

/**
 * Middleware: Requiere autenticación
 */
const requireAuth = async (req, res, next) => {
    try {
        // Obtener token del header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false, 
                message: 'Token de acceso requerido' 
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);

        if (!decoded) {
            return res.status(401).json({ 
                success: false, 
                message: 'Token inválido o expirado' 
            });
        }

        // Verificar que el usuario existe y está activo
        const result = await db.query(
            'SELECT id, uuid, email, username, user_number, is_active, is_banned FROM users WHERE id = $1',
            [decoded.id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Usuario no encontrado' 
            });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({ 
                success: false, 
                message: 'Cuenta desactivada' 
            });
        }

        if (user.is_banned) {
            return res.status(403).json({ 
                success: false, 
                message: 'Cuenta suspendida' 
            });
        }

        // Adjuntar usuario al request
        req.user = user;
        next();
    } catch (error) {
        console.error('Error en autenticación:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error de autenticación' 
        });
    }
};

/**
 * Middleware: Autenticación opcional
 * No falla si no hay token, pero si hay uno válido, adjunta el usuario
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            req.user = null;
            return next();
        }

        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);

        if (!decoded) {
            req.user = null;
            return next();
        }

        const result = await db.query(
            'SELECT id, uuid, email, username, user_number, is_active, is_banned FROM users WHERE id = $1',
            [decoded.id]
        );

        if (result.rows.length > 0 && result.rows[0].is_active && !result.rows[0].is_banned) {
            req.user = result.rows[0];
        } else {
            req.user = null;
        }

        next();
    } catch (error) {
        req.user = null;
        next();
    }
};

module.exports = {
    generateToken,
    verifyToken,
    requireAuth,
    optionalAuth
};
