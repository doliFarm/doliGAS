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

export const translations = {
  it: {
    // General
    app_name: "doliGAS",
    loading: "Caricamento in corso...",
    
    // Auth & Menu
    logout: "Esci",
    menu_privacy: "Privacy Policy",
    menu_credits: "Crediti & Info",
    menu_terms: "Termini di Utilizzo",
    menu_request_data: "Richiedi i miei dati",
    
    // Dashboard Status
    status_open: "ORDINI APERTI",
    status_closing_soon: "CHIUDE PRESTO",
    status_closed: "CHIUSO",
    closing_at: "Chiude il {{date}} alle {{time}}",
    
    // Dashboard Widgets
    wallet_title: "Il tuo Saldo",
    wallet_manage: "Gestisci Borsellino",
    shop_title: "Ciclo Attuale",
    shop_action_buy: "Vai alla Spesa",
    shop_action_continue: "Completa Ordine",
    shop_action_view: "Visualizza Ordine",
    
    // Alerts
    alert_coordinator: "Avviso Coordinatore",
    last_order_delivered: "Ultimo ordine consegnato",
    
    // Shop & Cart
    cart_total: "Totale Carrello",
    cart_saved: "Bozza salvata",
    cart_saving: "Salvataggio...",
    btn_save_draft: "Salva Bozza",
    btn_confirm_order: "Conferma Ordine",
    btn_repeat_order: "Ripeti",
    
    // Product List
    producer_moq_ok: "MOQ Raggiunto",
    producer_moq_missing: "Mancano {{missing}} {{unit}}",
    note_placeholder: "Note per il gestore...",
    
    // Wallet / Errors
    balance_available: "Saldo Disponibile",
    balance_insufficient: "Credito insufficiente",
    balance_insufficient_msg: "Il totale supera il tuo saldo. Ricarica per ordinare.",
    topup_online: "Ricarica Online (Immediata)",
    topup_transfer: "Bonifico Bancario",
    transfer_simulate: "Segnala Bonifico Effettuato",
    iban_copied: "IBAN Copiato!",
    
    // Transactions
    history_title: "Storico Transazioni",
    tx_topup: "Ricarica Online",
    tx_transfer: "Bonifico",
    tx_order: "Addebito Spesa",
    status_ok: "Eseguito",
    status_pending: "In Attesa",
  },
  
  // Ready for a future English version (optional for now)
  en: {
    app_name: "doliGAS",
    logout: "Logout",
    // ...
  }
};
