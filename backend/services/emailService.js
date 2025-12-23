/**
 * Servicio de Email - Envío de OTP
 */
const nodemailer = require('nodemailer');
require('dotenv').config();

// Configurar transporter
let transporter;

if (process.env.NODE_ENV === 'production') {
    // Configuración de producción (Gmail, SendGrid, etc.)
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false, // true para 465, false para otros
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
} else {
    // En desarrollo, crear cuenta de prueba en Ethereal
    nodemailer.createTestAccount().then(testAccount => {
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
        console.log('📧 Email de prueba configurado:', testAccount.user);
    }).catch(err => {
        console.log('⚠️ No se pudo crear cuenta de prueba, usando console.log');
    });
}

/**
 * Plantilla HTML para el email de OTP
 */
const getOTPEmailTemplate = (otp, type) => {
    const action = type === 'register' ? 'completar tu registro' : 'iniciar sesión';
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #1a1a2e; font-family: Arial, sans-serif;">
        <div style="max-width: 500px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: linear-gradient(135deg, #16213e 0%, #1a1a2e 100%); border-radius: 20px; padding: 40px; border: 1px solid rgba(255,255,255,0.1);">
                
                <!-- Logo -->
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="font-size: 28px; margin: 0; background: linear-gradient(135deg, #ff6b35, #9d4edd, #00c9b7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                        ☕ El Marrón de Oficina
                    </h1>
                </div>
                
                <!-- Mensaje -->
                <p style="color: #ffffff; font-size: 16px; line-height: 1.6; text-align: center; margin-bottom: 30px;">
                    Usa este código para ${action}:
                </p>
                
                <!-- Código OTP -->
                <div style="background: rgba(0,0,0,0.3); border-radius: 15px; padding: 25px; text-align: center; margin-bottom: 30px;">
                    <span style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #00c9b7;">
                        ${otp}
                    </span>
                </div>
                
                <!-- Advertencia -->
                <p style="color: #aaaaaa; font-size: 14px; text-align: center; margin-bottom: 20px;">
                    Este código expira en <strong style="color: #ff6b35;">10 minutos</strong>.
                </p>
                
                <p style="color: #666666; font-size: 12px; text-align: center; margin: 0;">
                    Si no solicitaste este código, ignora este mensaje.
                </p>
                
            </div>
            
            <!-- Footer -->
            <p style="color: #666666; font-size: 11px; text-align: center; margin-top: 20px;">
                El Marrón de Oficina - Donde el café sabe a verdad ☕<br>
                Hecho en Perú 🇵🇪
            </p>
        </div>
    </body>
    </html>
    `;
};

/**
 * Enviar email con código OTP
 */
const sendOTPEmail = async (email, otp, type = 'login') => {
    const subject = type === 'register' 
        ? '☕ Verifica tu cuenta - El Marrón de Oficina' 
        : '🔐 Tu código de acceso - El Marrón de Oficina';

    const mailOptions = {
        from: process.env.EMAIL_FROM || '"El Marrón de Oficina" <noreply@elmarron.pe>',
        to: email,
        subject: subject,
        html: getOTPEmailTemplate(otp, type),
        text: `Tu código de verificación para El Marrón de Oficina es: ${otp}. Expira en 10 minutos.`
    };

    try {
        // Si no hay transporter configurado (desarrollo sin Ethereal)
        if (!transporter) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📧 EMAIL DE DESARROLLO');
            console.log(`   Para: ${email}`);
            console.log(`   Asunto: ${subject}`);
            console.log(`   Código OTP: ${otp}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            return { success: true, messageId: 'dev-mode', otp };
        }

        const info = await transporter.sendMail(mailOptions);
        
        // En desarrollo con Ethereal, mostrar URL de preview
        if (process.env.NODE_ENV !== 'production') {
            console.log('📧 Email enviado:', info.messageId);
            console.log('   Preview URL:', nodemailer.getTestMessageUrl(info));
            // También mostrar el OTP en consola para facilitar desarrollo
            console.log(`   OTP para ${email}: ${otp}`);
        }

        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error enviando email:', error);
        // En desarrollo, no fallar - mostrar OTP en consola
        if (process.env.NODE_ENV !== 'production') {
            console.log(`⚠️ Fallback - OTP para ${email}: ${otp}`);
            return { success: true, messageId: 'fallback', otp };
        }
        throw error;
    }
};

module.exports = {
    sendOTPEmail
};
