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
 * @file backend/routes/contact.js
 * @description Landing page contacts: saves to the DB and sends an email notification.
 * Status: stable.
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const emailService = require('../emailService'); 

router.post('/request-demo', async (req, res) => {
  const { name, email, location, message } = req.body;

  // Basic input validation
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Campi obbligatori mancanti' });
  }

  try {
    // 1. Save to MySQL
    // Note: implicit transaction via execute
    await db.execute(
      'INSERT INTO leads (name, email, message, status, location, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [name, email, message, 'NEW', location || null]
    );

    // 2. Send the notification email
    // Use sendEmail or sendNotification, passing the HTML for better readability
    await emailService.sendEmail({
      to: 'luigi.grillo@gmail.com', // Put the real destination address here or read it from config
      subject: `[doliGAS] Nuova Richiesta Demo da ${name}`,
      text: `Nome: ${name}\nEmail: ${email}\nLocalità: ${location}\nMessaggio: ${message}`,
      html: `
        <h3>Nuova richiesta demo ricevuta</h3>
        <p><strong>Nome:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Località:</strong> ${location || 'Non specificata'}</p>
        <p><strong>Messaggio:</strong><br>${message.replace(/\n/g, '<br>')}</p>
      `
    });

    res.status(200).json({ success: true, message: 'Richiesta ricevuta con successo' });
  } catch (error) {
    // Detailed log for debugging (visible in the container/process logs)
    console.error('ERRORE CONTATTO doliGAS:', error);
    res.status(500).json({ error: 'Errore interno durante l\'elaborazione della richiesta' });
  }
});

module.exports = router;