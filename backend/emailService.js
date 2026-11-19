/*
 * doliGAS - Solidarity purchasing group (GAS) management platform
 * Copyright (C) 2026 Luigi Grillo (doliFarm)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * @file backend/emailService.js
 * @version v2.1.2 (local Postfix restored)
 * Status: complete
 */
const nodemailer = require('nodemailer');
require('dotenv').config();

const sendEmail = async (to, subject, text, html = null) => {
    const isConfigured = process.env.SMTP_HOST && process.env.SMTP_HOST.length > 0;

    if (!isConfigured) {
        console.log("\n================ [EMAIL MOCK MODE] ================");
        console.log(`⚠️ SMTP_HOST mancante. Invio simulato a: ${to}`);
        return { messageId: 'MOCK-ID-' + Date.now() }; 
    }

    const port = parseInt(process.env.SMTP_PORT) || 587;
    const secure = port === 465; 

    let transportConfig = {
        host: process.env.SMTP_HOST,
        port: port,
        secure: secure,
        ignoreTLS: true,
        tls: { rejectUnauthorized: false }
    };

    // KEY CONDITION FOR POSTFIX: authenticate only if a user is set
    if (process.env.SMTP_USER && process.env.SMTP_USER.trim() !== '') {
        transportConfig.auth = {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        };
    }

    const transporter = nodemailer.createTransport(transportConfig);

    try {
        const info = await transporter.sendMail({
            from: `"${process.env.SMTP_FROM_NAME || 'doliGAS System'}" <${process.env.SMTP_FROM_EMAIL || 'info@doligas.com'}>`,
            to: to,
            subject: subject,
            text: text,
            html: html || text.replace(/\n/g, '<br>')
        });
        console.log(`✅ [EMAIL SENT] ID: ${info.messageId} | To: ${to}`);
        return info;
    } catch (error) {
        console.error("❌ [EMAIL ERROR]", error);
        throw error; 
    }
};

const sendNotification = async ({ subject, text, html }) => {
    const adminEmail = process.env.ADMIN_EMAIL;
    
    if (!adminEmail) {
        console.warn("⚠️ [WARN] Tentativo di sendNotification fallito: ADMIN_EMAIL non configurato nel .env");
        return false;
    }
    
    try {
        return await sendEmail(adminEmail, subject, text, html);
    } catch (e) { 
        console.error("❌ [NOTIFICATION ERROR]", e);
        return false; 
    }
};

// Added for compatibility with the auth route
const sendOTPLink = async (email, token, gasSlug = 'demo') => {
    const baseUrl = process.env.FRONTEND_URL || 'https://www.doligas.com';
    const magicLink = `${baseUrl}/auth/verify?token=${token}&gas=${gasSlug}`;
    
    return sendEmail(
        email, 
        "Accesso a doliGAS", 
        `Link di accesso: ${magicLink}`, 
        `<h3>Benvenuto!</h3><p>Clicca qui per accedere: <a href="${magicLink}">${magicLink}</a></p>`
    );
};



/**
 * SECURITY: neutralizes HTML in user-supplied text before it goes into an email.
 */
const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

module.exports = { sendEmail, sendNotification, sendOTPLink, escapeHtml };