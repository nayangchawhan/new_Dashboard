import React, { useEffect } from 'react';
import emailjs from '@emailjs/browser';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

// Initialize EmailJS with original public key
try {
  emailjs.init({
    publicKey: "QvH2Lm8ULfKLJLjzG",
  });
} catch (e) {
  console.warn('EmailJS initialization note:', e);
}

export function sendAlertEmail(value, msg) {
  const templateParams = {
    to_name: 'User',
    message: `${msg}: ${value}.`,
    reply_to: 'nayangc2005@gmail.com'
  };

  return emailjs.send('service_yr2ypt5', 'template_oeop7br', templateParams)
    .then(res => {
      console.log('[EmailJS] Alert email sent:', res.status, res.text);
      return res;
    })
    .catch(err => {
      console.warn('[EmailJS] Alert email delivery notice:', err);
      return null;
    });
}

export default function NotificationToast({ notification, onClose }) {
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [notification, onClose]);

  if (!notification) return null;

  const { message, type = 'info' } = notification;

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle size={18} />;
      case 'warning': return <AlertCircle size={18} />;
      case 'danger': return <AlertCircle size={18} />;
      default: return <Info size={18} />;
    }
  };

  return (
    <div className={`notification-toast ${type}`}>
      {getIcon()}
      <span style={{ flex: 1, fontSize: '13px', fontWeight: 500 }}>{message}</span>
      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
