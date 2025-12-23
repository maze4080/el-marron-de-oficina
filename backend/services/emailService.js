/**
 * Servicio de Email - Envío de OTP
 */

const sendOTPEmail = async (email, otp, type = 'login') => {
    // En producción sin SMTP configurado, mostramos el OTP en consola
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 CÓDIGO OTP');
    console.log(`   Email: ${email}`);
    console.log(`   Código: ${otp}`);
    console.log(`   Tipo: ${type}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return { success: true, messageId: 'console-mode', otp };
};

module.exports = {
    sendOTPEmail
};
