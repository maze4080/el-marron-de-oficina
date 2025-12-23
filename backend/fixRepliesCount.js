/**
 * Script para crear trigger y arreglar contadores de respuestas
 * Ejecutar una sola vez
 */
const pool = require('./config/database');

async function fixRepliesCount() {
    try {
        console.log('🔧 Iniciando corrección de contadores...');

        // Crear función para el trigger
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
        console.log('✅ Función creada');

        // Eliminar trigger si existe
        await pool.query(`DROP TRIGGER IF EXISTS trigger_update_replies_count ON replies;`);
        console.log('✅ Trigger anterior eliminado');

        // Crear trigger
        await pool.query(`
            CREATE TRIGGER trigger_update_replies_count
            AFTER INSERT OR DELETE OR UPDATE OF is_deleted ON replies
            FOR EACH ROW
            EXECUTE FUNCTION update_replies_count();
        `);
        console.log('✅ Trigger creado');

        // Actualizar contadores existentes
        await pool.query(`
            UPDATE posts SET replies_count = (
                SELECT COUNT(*) FROM replies 
                WHERE replies.post_id = posts.id AND replies.is_deleted = false
            );
        `);
        console.log('✅ Contadores actualizados');

        console.log('🎉 ¡Todo listo!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixRepliesCount();
