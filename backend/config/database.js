/**
 * Configuración de conexión a PostgreSQL
 */
const { Pool } = require('pg');
require('dotenv').config();

// Configuración del pool de conexiones
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // O configuración separada:
    // host: process.env.DB_HOST || 'localhost',
    // port: process.env.DB_PORT || 5432,
    // database: process.env.DB_NAME || 'el_marron_db',
    // user: process.env.DB_USER,
    // password: process.env.DB_PASSWORD,
    
    // Configuración del pool
    max: 20,                    // Máximo de conexiones
    idleTimeoutMillis: 30000,   // Tiempo antes de cerrar conexión idle
    connectionTimeoutMillis: 2000, // Tiempo de espera para conexión
});

// Evento de error en el pool
pool.on('error', (err) => {
    console.error('❌ Error inesperado en el pool de PostgreSQL:', err);
    process.exit(-1);
});

// Verificar conexión al iniciar
pool.query('SELECT NOW()')
    .then(() => console.log('✅ Conectado a PostgreSQL'))
    .catch(err => console.error('❌ Error conectando a PostgreSQL:', err.message));

/**
 * Ejecutar query con parámetros
 */
const query = (text, params) => pool.query(text, params);

/**
 * Obtener un cliente del pool (para transacciones)
 */
const getClient = () => pool.connect();

module.exports = {
    query,
    getClient,
    pool
};
