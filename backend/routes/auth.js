/**
 * Rutas de Autenticación
 * /api/auth/*
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { sendOTPEmail } = require('../services/emailService');
const { generateToken, requireAuth } = require('../middleware/auth');

// Generar código OTP de 6 dígitos
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Tiempo de expiración del OTP (en minutos)
const OTP_EXPIRES_MINUTES = parseInt(process.env.OTP_EXPIRES_MINUTES) || 10;

/**
 * POST /api/auth/register/send-otp
 * Enviar OTP para registro
 */
router.post('/register/send-otp', [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Email inválido')
], async (req, res) => {
    try {
        // Validar input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }

        const { email } = req.body;

        // Verificar si el email ya está registrado
        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Este email ya está registrado. Por favor inicia sesión.' 
            });
        }

        // Invalidar OTPs anteriores para este email
        await db.query(
            'UPDATE otp_codes SET is_used = true WHERE email = $1 AND type = $2',
            [email, 'register']
        );

        // Generar nuevo OTP
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

        // Guardar OTP en base de datos
        await db.query(
            'INSERT INTO otp_codes (email, code, type, expires_at) VALUES ($1, $2, $3, $4)',
            [email, otp, 'register', expiresAt]
        );

        // Enviar email
        await sendOTPEmail(email, otp, 'register');

        res.json({ 
            success: true, 
            message: 'Código de verificación enviado',
            // Solo en desarrollo:
            ...(process.env.NODE_ENV !== 'production' && { dev_otp: otp })
        });

    } catch (error) {
        console.error('Error en registro/send-otp:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al enviar código de verificación' 
        });
    }
});

/**
 * POST /api/auth/register/verify-otp
 * Verificar OTP y crear cuenta
 */
router.post('/register/verify-otp', [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }

        const { email, otp } = req.body;

        // Buscar OTP válido
        const otpResult = await db.query(`
            SELECT id, attempts FROM otp_codes 
            WHERE email = $1 
              AND code = $2 
              AND type = 'register'
              AND is_used = false 
              AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 1
        `, [email, otp]);

        if (otpResult.rows.length === 0) {
            // Incrementar intentos fallidos
            await db.query(`
                UPDATE otp_codes 
                SET attempts = attempts + 1 
                WHERE email = $1 AND type = 'register' AND is_used = false
            `, [email]);

            return res.status(400).json({ 
                success: false, 
                message: 'Código incorrecto o expirado' 
            });
        }

        const otpRecord = otpResult.rows[0];

        // Verificar máximo de intentos
        if (otpRecord.attempts >= 5) {
            return res.status(429).json({ 
                success: false, 
                message: 'Demasiados intentos. Solicita un nuevo código.' 
            });
        }

        // Marcar OTP como usado
        await db.query(
            'UPDATE otp_codes SET is_used = true WHERE id = $1',
            [otpRecord.id]
        );

        // Obtener siguiente número de usuario
        const nextNumberResult = await db.query('SELECT get_next_user_number() as next_num');
        const userNumber = nextNumberResult.rows[0].next_num;
        const username = `Marrón ${userNumber}`;

        // Crear usuario
        const userResult = await db.query(`
            INSERT INTO users (email, username, user_number) 
            VALUES ($1, $2, $3) 
            RETURNING id, uuid, email, username, user_number, created_at
        `, [email, username, userNumber]);

        const newUser = userResult.rows[0];

        // Generar token
        const token = generateToken(newUser);

        res.status(201).json({
            success: true,
            message: '¡Cuenta creada exitosamente!',
            user: {
                uuid: newUser.uuid,
                username: newUser.username,
                userNumber: newUser.user_number
            },
            token
        });

    } catch (error) {
        console.error('Error en registro/verify-otp:', error);
        
        // Manejar error de duplicado (race condition)
        if (error.code === '23505') {
            return res.status(400).json({ 
                success: false, 
                message: 'Este email ya está registrado' 
            });
        }

        res.status(500).json({ 
            success: false, 
            message: 'Error al verificar código' 
        });
    }
});

/**
 * POST /api/auth/login/send-otp
 * Enviar OTP para login
 */
router.post('/login/send-otp', [
    body('email').isEmail().normalizeEmail()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }

        const { email } = req.body;

        // Verificar que el usuario existe
        const userResult = await db.query(
            'SELECT id, is_active, is_banned FROM users WHERE email = $1',
            [email]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Email no registrado. ¿Quieres crear una cuenta?' 
            });
        }

        const user = userResult.rows[0];

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

        // Invalidar OTPs anteriores
        await db.query(
            'UPDATE otp_codes SET is_used = true WHERE email = $1 AND type = $2',
            [email, 'login']
        );

        // Generar nuevo OTP
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

        await db.query(
            'INSERT INTO otp_codes (email, code, type, expires_at) VALUES ($1, $2, $3, $4)',
            [email, otp, 'login', expiresAt]
        );

        // Enviar email
        await sendOTPEmail(email, otp, 'login');

        res.json({ 
            success: true, 
            message: 'Código de acceso enviado',
            ...(process.env.NODE_ENV !== 'production' && { dev_otp: otp })
        });

    } catch (error) {
        console.error('Error en login/send-otp:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al enviar código' 
        });
    }
});

/**
 * POST /api/auth/login/verify-otp
 * Verificar OTP y hacer login
 */
router.post('/login/verify-otp', [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }

        const { email, otp } = req.body;

        // Buscar OTP válido
        const otpResult = await db.query(`
            SELECT id, attempts FROM otp_codes 
            WHERE email = $1 
              AND code = $2 
              AND type = 'login'
              AND is_used = false 
              AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 1
        `, [email, otp]);

        if (otpResult.rows.length === 0) {
            await db.query(`
                UPDATE otp_codes 
                SET attempts = attempts + 1 
                WHERE email = $1 AND type = 'login' AND is_used = false
            `, [email]);

            return res.status(400).json({ 
                success: false, 
                message: 'Código incorrecto o expirado' 
            });
        }

        const otpRecord = otpResult.rows[0];

        if (otpRecord.attempts >= 5) {
            return res.status(429).json({ 
                success: false, 
                message: 'Demasiados intentos. Solicita un nuevo código.' 
            });
        }

        // Marcar OTP como usado
        await db.query(
            'UPDATE otp_codes SET is_used = true WHERE id = $1',
            [otpRecord.id]
        );

        // Obtener usuario y actualizar last_login
        const userResult = await db.query(`
            UPDATE users 
            SET last_login = NOW() 
            WHERE email = $1 
            RETURNING id, uuid, email, username, user_number
        `, [email]);

        const user = userResult.rows[0];
        const token = generateToken(user);

        res.json({
            success: true,
            message: `¡Bienvenido/a, ${user.username}!`,
            user: {
                uuid: user.uuid,
                username: user.username,
                userNumber: user.user_number
            },
            token
        });

    } catch (error) {
        console.error('Error en login/verify-otp:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al iniciar sesión' 
        });
    }
});

/**
 * GET /api/auth/me
 * Obtener perfil del usuario actual
 */
router.get('/me', requireAuth, async (req, res) => {
    res.json({
        success: true,
        user: {
            uuid: req.user.uuid,
            username: req.user.username,
            userNumber: req.user.user_number,
            email: req.user.email
        }
    });
});

/**
 * POST /api/auth/logout
 * Cerrar sesión (principalmente para logging)
 */
router.post('/logout', requireAuth, async (req, res) => {
    // En una implementación con refresh tokens, aquí invalidaríamos el token
    res.json({
        success: true,
        message: 'Sesión cerrada'
    });
});

module.exports = router;
