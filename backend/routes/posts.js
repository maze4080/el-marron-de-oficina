/**
 * Rutas de Posts
 * /api/posts/*
 */
const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const db = require('../config/database');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// Categorías válidas
const VALID_CATEGORIES = ['chisme', 'queja', 'humor', 'consejo', 'random'];

/**
 * GET /api/posts
 * Obtener lista de posts (con paginación y filtros)
 */
router.get('/', optionalAuth, [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    query('category').optional().isIn(VALID_CATEGORIES)
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const page = req.query.page || 1;
        const limit = req.query.limit || 20;
        const offset = (page - 1) * limit;
        const category = req.query.category;
        const userId = req.user?.id;

        // Construir query base
        let queryText = `
            SELECT 
                p.id,
                p.uuid,
                p.content,
                p.category,
                p.likes_count,
                p.replies_count,
                p.created_at,
                u.username,
                u.user_number,
                ${userId ? `
                    EXISTS(
                        SELECT 1 FROM likes 
                        WHERE likes.post_id = p.id AND likes.user_id = $3
                    ) as user_liked
                ` : 'false as user_liked'}
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.is_deleted = false
        `;

        const params = [limit, offset];
        let paramIndex = userId ? 4 : 3;

        if (userId) {
            params.push(userId);
        }

        if (category) {
            queryText += ` AND p.category = $${paramIndex}`;
            params.push(category);
        }

        queryText += ` ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`;

        const result = await db.query(queryText, params);

        // Obtener total de posts para paginación
        let countQuery = 'SELECT COUNT(*) FROM posts WHERE is_deleted = false';
        const countParams = [];
        
        if (category) {
            countQuery += ' AND category = $1';
            countParams.push(category);
        }

        const countResult = await db.query(countQuery, countParams);
        const totalPosts = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalPosts / limit);

        res.json({
            success: true,
            data: {
                posts: result.rows.map(post => ({
                    id: post.uuid,
                    content: post.content,
                    category: post.category,
                    likesCount: post.likes_count,
                    repliesCount: post.replies_count,
                    createdAt: post.created_at,
                    author: {
                        username: post.username,
                        userNumber: post.user_number
                    },
                    userLiked: post.user_liked
                })),
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalPosts,
                    hasMore: page < totalPages
                }
            }
        });

    } catch (error) {
        console.error('Error obteniendo posts:', error);
        res.status(500).json({ success: false, message: 'Error al obtener posts' });
    }
});

/**
 * GET /api/posts/:uuid
 * Obtener un post específico con sus respuestas
 */
router.get('/:uuid', optionalAuth, [
    param('uuid').isUUID()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { uuid } = req.params;
        const userId = req.user?.id;

        // Obtener post
        const postResult = await db.query(`
            SELECT 
                p.id,
                p.uuid,
                p.content,
                p.category,
                p.likes_count,
                p.replies_count,
                p.created_at,
                u.username,
                u.user_number,
                ${userId ? `
                    EXISTS(
                        SELECT 1 FROM likes 
                        WHERE likes.post_id = p.id AND likes.user_id = $2
                    ) as user_liked
                ` : 'false as user_liked'}
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.uuid = $1 AND p.is_deleted = false
        `, userId ? [uuid, userId] : [uuid]);

        if (postResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Post no encontrado' });
        }

        const post = postResult.rows[0];

        // Obtener respuestas
        const repliesResult = await db.query(`
            SELECT 
                r.uuid,
                r.content,
                r.created_at,
                u.username,
                u.user_number
            FROM replies r
            JOIN users u ON r.user_id = u.id
            WHERE r.post_id = $1 AND r.is_deleted = false
            ORDER BY r.created_at ASC
        `, [post.id]);

        res.json({
            success: true,
            data: {
                post: {
                    id: post.uuid,
                    content: post.content,
                    category: post.category,
                    likesCount: post.likes_count,
                    repliesCount: post.replies_count,
                    createdAt: post.created_at,
                    author: {
                        username: post.username,
                        userNumber: post.user_number
                    },
                    userLiked: post.user_liked
                },
                replies: repliesResult.rows.map(reply => ({
                    id: reply.uuid,
                    content: reply.content,
                    createdAt: reply.created_at,
                    author: {
                        username: reply.username,
                        userNumber: reply.user_number
                    }
                }))
            }
        });

    } catch (error) {
        console.error('Error obteniendo post:', error);
        res.status(500).json({ success: false, message: 'Error al obtener post' });
    }
});

/**
 * POST /api/posts
 * Crear nuevo post
 */
router.post('/', requireAuth, [
    body('content')
        .trim()
        .isLength({ min: 10, max: 2000 })
        .withMessage('El contenido debe tener entre 10 y 2000 caracteres'),
    body('category')
        .isIn(VALID_CATEGORIES)
        .withMessage('Categoría inválida')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { content, category } = req.body;
        const userId = req.user.id;

        const result = await db.query(`
            INSERT INTO posts (user_id, content, category)
            VALUES ($1, $2, $3)
            RETURNING uuid, content, category, likes_count, replies_count, created_at
        `, [userId, content, category]);

        const post = result.rows[0];

        res.status(201).json({
            success: true,
            message: '¡Marrón publicado!',
            data: {
                post: {
                    id: post.uuid,
                    content: post.content,
                    category: post.category,
                    likesCount: post.likes_count,
                    repliesCount: post.replies_count,
                    createdAt: post.created_at,
                    author: {
                        username: req.user.username,
                        userNumber: req.user.user_number
                    },
                    userLiked: false
                }
            }
        });

    } catch (error) {
        console.error('Error creando post:', error);
        res.status(500).json({ success: false, message: 'Error al publicar' });
    }
});

/**
 * DELETE /api/posts/:uuid
 * Eliminar post propio
 */
router.delete('/:uuid', requireAuth, [
    param('uuid').isUUID()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { uuid } = req.params;
        const userId = req.user.id;

        // Verificar que el post pertenece al usuario
        const result = await db.query(`
            UPDATE posts 
            SET is_deleted = true 
            WHERE uuid = $1 AND user_id = $2 AND is_deleted = false
            RETURNING uuid
        `, [uuid, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Post no encontrado o no tienes permiso para eliminarlo' 
            });
        }

        res.json({ success: true, message: 'Post eliminado' });

    } catch (error) {
        console.error('Error eliminando post:', error);
        res.status(500).json({ success: false, message: 'Error al eliminar post' });
    }
});

/**
 * POST /api/posts/:uuid/like
 * Dar/quitar like a un post
 */
router.post('/:uuid/like', requireAuth, [
    param('uuid').isUUID()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { uuid } = req.params;
        const userId = req.user.id;

        // Obtener ID del post
        const postResult = await db.query(
            'SELECT id FROM posts WHERE uuid = $1 AND is_deleted = false',
            [uuid]
        );

        if (postResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Post no encontrado' });
        }

        const postId = postResult.rows[0].id;

        // Verificar si ya tiene like
        const likeResult = await db.query(
            'SELECT id FROM likes WHERE user_id = $1 AND post_id = $2',
            [userId, postId]
        );

        let liked;
        if (likeResult.rows.length > 0) {
            // Quitar like
            await db.query(
                'DELETE FROM likes WHERE user_id = $1 AND post_id = $2',
                [userId, postId]
            );
            liked = false;
        } else {
            // Dar like
            await db.query(
                'INSERT INTO likes (user_id, post_id) VALUES ($1, $2)',
                [userId, postId]
            );
            liked = true;
        }

        // Obtener nuevo count
        const countResult = await db.query(
            'SELECT likes_count FROM posts WHERE id = $1',
            [postId]
        );

        res.json({
            success: true,
            data: {
                liked,
                likesCount: countResult.rows[0].likes_count
            }
        });

    } catch (error) {
        console.error('Error en like:', error);
        res.status(500).json({ success: false, message: 'Error al procesar like' });
    }
});

/**
 * POST /api/posts/:uuid/replies
 * Responder a un post
 */
router.post('/:uuid/replies', requireAuth, [
    param('uuid').isUUID(),
    body('content')
        .trim()
        .isLength({ min: 5, max: 1000 })
        .withMessage('La respuesta debe tener entre 5 y 1000 caracteres')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { uuid } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        // Obtener ID del post
        const postResult = await db.query(
            'SELECT id FROM posts WHERE uuid = $1 AND is_deleted = false',
            [uuid]
        );

        if (postResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Post no encontrado' });
        }

        const postId = postResult.rows[0].id;

        // Crear respuesta
        const result = await db.query(`
            INSERT INTO replies (post_id, user_id, content)
            VALUES ($1, $2, $3)
            RETURNING uuid, content, created_at
        `, [postId, userId, content]);

        const reply = result.rows[0];

        res.status(201).json({
            success: true,
            message: 'Respuesta publicada',
            data: {
                reply: {
                    id: reply.uuid,
                    content: reply.content,
                    createdAt: reply.created_at,
                    author: {
                        username: req.user.username,
                        userNumber: req.user.user_number
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error creando respuesta:', error);
        res.status(500).json({ success: false, message: 'Error al responder' });
    }
});

/**
 * GET /api/posts/stats/summary
 * Obtener estadísticas del foro
 */
router.get('/stats/summary', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM posts WHERE is_deleted = false) as total_posts,
                (SELECT COUNT(*) FROM users WHERE is_active = true) as total_users,
                (SELECT COUNT(*) FROM replies WHERE is_deleted = false) as total_replies
        `);

        res.json({
            success: true,
            data: {
                totalPosts: parseInt(result.rows[0].total_posts),
                totalUsers: parseInt(result.rows[0].total_users),
                totalReplies: parseInt(result.rows[0].total_replies)
            }
        });

    } catch (error) {
        console.error('Error obteniendo stats:', error);
        res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
    }
});

module.exports = router;
