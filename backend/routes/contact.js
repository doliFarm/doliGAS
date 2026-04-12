/**
 * @file backend/routes/contact.js
 * @description Gestione contatti landing page: salvataggio DB e notifica email.
 * Stato: INTEGRO, COMPLETO, ROBUSTO.
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const emailService = require('../emailService'); 

router.post('/request-demo', async (req, res) => {
  const { name, email, location, message } = req.body;

  // Validazione input base (Robustezza)
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Campi obbligatori mancanti' });
  }

  try {
    // 1. Salvataggio su MySQL
    // Nota: Usiamo una transazione implicita via execute
    await db.execute(
      'INSERT INTO leads (name, email, message, status, location, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [name, email, message, 'NEW', location || null]
    );

    // 2. Invio Email di notifica
    // Usiamo il metodo sendEmail o sendNotification assicurandoci di passare l'html per una migliore leggibilità
    await emailService.sendEmail({
      to: 'luigi.grillo@gmail.com', // Inserisci qui l'email di destinazione reale o prendila da config
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
    // Log dettagliato per debug (visibile nei log del container/processo)
    console.error('ERRORE CONTATTO doliGAS:', error);
    res.status(500).json({ error: 'Errore interno durante l\'elaborazione della richiesta' });
  }
});

module.exports = router;