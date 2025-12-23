/**
 * Servicio de Email - Envío de OTP con Resend
 */

const sendOTPEmail = async (email, otp, type = 'login') => {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    
    if (!RESEND_API_KEY) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📧 CÓDIGO OTP (modo desarrollo)');
        console.log(`   Email: ${email}`);
        console.log(`   Código: ${otp}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return { success: true, messageId: 'dev-mode' };
    }

    const subject = type === 'register' 
        ? '☕ Verifica tu cuenta - El Marrón de Oficina' 
        : '🔐 Tu código de acceso - El Marrón de Oficina';

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'El Marrón de Oficina <onboarding@resend.dev>',
                to: email,
                subject: subject,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                        <h1 style="color: #ff6b35;">☕ El Marrón de Oficina</h1>
                        <p>Tu código de verificación es:</p>
                        <div style="background: #1a1a2e; color: #00c9b7; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 10px; letter-spacing: 5px;">
                            ${otp}
                        </div>
                        <p style="color: #666; margin-top: 20px;">Este código expira en 10 minutos.</p>
                        <p style="color: #999; font-size: 12px;">Si no solicitaste este código, ignora este mensaje.</p>
                    </div>
                `
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            console.log(`✅ Email enviado a ${email}`);
            return { success: true, messageId: data.id };
        } else {
            console.error('❌ Error Resend:', data);
            throw new Error(data.message || 'Error enviando email');
        }
    } catch (error) {
        console.error('❌ Error enviando email:', error);
        throw error;
    }
};

module.exports = {
    sendOTPEmail
};
