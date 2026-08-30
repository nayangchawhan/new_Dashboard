import emailjs from '@emailjs/browser';

// EmailJS Configuration
export const EMAILJS_CONFIG = {
  SERVICE_ID: 'service_f6r9fah',
  TEMPLATE_ID: 'template_o5h6xwq',
  PUBLIC_KEY: 'kqHRXhhFS5TvA3zZH'
};

// Initialize EmailJS
try {
  emailjs.init({
    publicKey: EMAILJS_CONFIG.PUBLIC_KEY,
  });
} catch (e) {
  console.warn('EmailJS initialization notice:', e);
}

/**
 * Dispatches a high temperature alert email via EmailJS
 * @param {Object} params - Dynamic alert parameters
 * @param {string} params.userName - Name of recipient user
 * @param {number|string} params.temperature - Current sensor reading
 * @param {number|string} params.threshold - Configured safety threshold
 * @param {string} params.location - Location or sensor identifier
 * @param {string} params.timestamp - Formatted timestamp of detection
 * @param {string} params.toEmail - Recipient email address
 */
export async function sendTemperatureAlertEmail({
  userName = 'Nayan Chawhan',
  temperature = 31.0,
  threshold = 30.0,
  location = 'ORBIT Smart Home • Living Room Node',
  timestamp = null,
  toEmail = 'nayangc2005@gmail.com'
}) {
  const formattedTime = timestamp || new Date().toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const templateParams = {
    user_name: userName || 'User',
    temperature: typeof temperature === 'number' ? temperature.toFixed(1) : String(temperature),
    threshold: typeof threshold === 'number' ? threshold.toFixed(1) : String(threshold),
    location: location || 'ORBIT Smart Home Node',
    timestamp: formattedTime,
    to_email: toEmail || 'nayangc2005@gmail.com',
    email: toEmail || 'nayangc2005@gmail.com',
    reply_to: toEmail || 'nayangc2005@gmail.com'
  };

  try {
    const res = await emailjs.send(
      EMAILJS_CONFIG.SERVICE_ID,
      EMAILJS_CONFIG.TEMPLATE_ID,
      templateParams,
      EMAILJS_CONFIG.PUBLIC_KEY
    );
    console.log('[EmailJS] High Temperature Alert Email sent successfully:', res.status, res.text);
    return { success: true, status: res.status, text: res.text, params: templateParams };
  } catch (err) {
    console.warn('[EmailJS] High Temperature Alert Email delivery error:', err);
    return { success: false, error: err?.text || err?.message || 'Email dispatch failed', params: templateParams };
  }
}

/**
 * Generic Alert Email for motion, battery, and hub temperature
 */
export async function sendGenericAlertEmail(value, msg, toEmail = 'nayangc2005@gmail.com', userName = 'User') {
  const templateParams = {
    user_name: userName,
    message: `${msg}: ${value}`,
    to_email: toEmail,
    email: toEmail,
    reply_to: toEmail,
    timestamp: new Date().toLocaleString()
  };

  try {
    const res = await emailjs.send(
      EMAILJS_CONFIG.SERVICE_ID,
      EMAILJS_CONFIG.TEMPLATE_ID,
      templateParams,
      EMAILJS_CONFIG.PUBLIC_KEY
    );
    return { success: true, status: res.status };
  } catch (err) {
    console.warn('[EmailJS] Generic alert dispatch note:', err);
    return { success: false, error: err };
  }
}
