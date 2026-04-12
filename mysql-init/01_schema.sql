-- =============================================================================
-- GASHUB DATABASE FULL SCHEMA v22.0
-- STATUS: Integro, Completo, Robusto.
-- FEATURES: Audit Tracing (4 campi), Magic Links, G1-G7 Master, Wallet.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS gashub_prod;
USE gashub_prod;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. RESET TOTALE
DROP TABLE IF EXISTS magic_links;
DROP TABLE IF EXISTS wallet_transactions;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS cycles;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS product_categories;
DROP TABLE IF EXISTS producers;
DROP TABLE IF EXISTS gas_memberships;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS gas;
DROP TABLE IF EXISTS holidays;
DROP TABLE IF EXISTS product_units;
DROP TABLE IF EXISTS notifications;

-- 2. TABELLE ANAGRAFICHE E SICUREZZA
CREATE TABLE roles (
    id INT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO roles (id, name) VALUES (1, 'Coordinatore'), (2, 'Produttore'), (3, 'Socio');

CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(191) UNIQUE NOT NULL,
    phone VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255) DEFAULT 'magic_link_only',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE gas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    email_contact VARCHAR(191),
    phone VARCHAR(50),
    website VARCHAR(255),
    address TEXT,
    iban VARCHAR(34),
    delivery_day_of_week INT DEFAULT 5,
    -- Offset snapshot v16.0
    g1_avvio_offset INT DEFAULT 10,
    g2_listini_fornitori_offset INT DEFAULT 8,
    g3_apertura_ordini_soci_offset INT DEFAULT 7,
    g4_chiusura_ordini_soci_offset INT DEFAULT 2,
    g5_invio_ordini_fornitori_offset INT DEFAULT 2,
    g6_conferma_fornitori_offset INT DEFAULT 1,
    g7_consegna_checkout_offset INT DEFAULT 0,
    is_active INT(1) DEFAULT 1,
    -- Settings
    allow_insufficient_balance INT(1) DEFAULT 0,
    -- Audit Fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    updated_by INT,
    manage_payments INT(1) DEFAULT 1,
    manage_payments INT(1) DEFAULT 1,
    manage_deliveries INT(1) DEFAULT 1,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_gas_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE gas_memberships (
    id INT PRIMARY KEY AUTO_INCREMENT,
    gas_id INT NOT NULL,
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    -- Contabilità e anagrafica specifica del contesto
    balance DECIMAL(12,2) DEFAULT 0.00,
    address TEXT,
    internal_notes TEXT,
    -- Stato operativo
    is_active TINYINT(1) DEFAULT 1,  
    -- Audit Tracing (Integrità storica)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    updated_by INT,
    -- Vincoli di Integrità Referenziale
    -- Se il GAS viene eliminato, eliminiamo le membership (CASCADE OK)
    CONSTRAINT fk_membership_gas 
        FOREIGN KEY (gas_id) REFERENCES gas(id) 
        ON DELETE CASCADE,
    -- Se l'utente esiste in users, impediamo la cancellazione se ha membership attive (RESTRICT)
    CONSTRAINT fk_membership_user 
        FOREIGN KEY (user_id) REFERENCES users(id) 
        ON DELETE RESTRICT,
    -- Ruoli e Audit
    CONSTRAINT fk_membership_role 
        FOREIGN KEY (role_id) REFERENCES roles(id),
    CONSTRAINT fk_membership_creator 
        FOREIGN KEY (created_by) REFERENCES users(id) 
        ON DELETE SET NULL,
    CONSTRAINT fk_membership_updater 
        FOREIGN KEY (updated_by) REFERENCES users(id) 
        ON DELETE SET NULL,
    -- Impedisce doppie iscrizioni dello stesso utente allo stesso GAS
    UNIQUE KEY idx_unique_user_gas (gas_id, user_id),
    -- Indice di performance per recupero rapido saldo e stato
    INDEX idx_membership_lookup (gas_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE magic_links (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. CATALOGO E PRODUTTORI
CREATE TABLE producers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    gas_id INT NOT NULL,
    user_id INT DEFAULT NULL,
    business_name VARCHAR(255) NOT NULL,
    vat_number VARCHAR(50),
    contact_name VARCHAR(255),
    contact_email VARCHAR(191),
    contact_phone VARCHAR(50),
    address TEXT,
    iban VARCHAR(34),
    internal_notes TEXT,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    updated_by INT,
    FOREIGN KEY (gas_id) REFERENCES gas(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE product_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    gas_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    updated_by INT,
    FOREIGN KEY (gas_id) REFERENCES gas(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    producer_id INT NOT NULL,
    category_id INT,
    unit_id INT NOT NULL, -- Sostituisce VARCHAR unit
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock INT DEFAULT NULL,
    min_order_qty DECIMAL(10,2) DEFAULT 1.00,
    is_active TINYINT(1) DEFAULT 1,
    
    -- Audit Tracing
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    updated_by INT,
    
    -- Vincoli di Integrità Referenziale
    FOREIGN KEY (producer_id) REFERENCES producers(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (unit_id) REFERENCES product_units(id),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. LOGISTICA OPERATIVA
CREATE TABLE cycles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    gas_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_active TINYINT(1) DEFAULT 0,
    -- Date Engine v37.0
    start_at DATETIME NOT NULL,
    producers_deadline DATETIME NOT NULL,
    market_open_at DATETIME NOT NULL,
    market_close_at DATETIME NOT NULL,
    orders_sent_at DATETIME NOT NULL,
    confirmation_at DATETIME NOT NULL,
    delivery_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    updated_by INT,
    FOREIGN KEY (gas_id) REFERENCES gas(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    gas_id INT NOT NULL,
    user_id INT NOT NULL,
    cycle_id INT NOT NULL,
    
    -- Default a 0.00 perché una bozza appena creata può essere vuota
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    
    -- ENUM Aggiornato:
    -- 'draft': Il carrello aperto (Punto 4)
    -- 'confirmed': L'utente ha inviato l'ordine (entro la scadenza)
    -- 'processing': Mercato chiuso, merce in gestione (Logistica)
    -- 'delivered': Merce consegnata/ritirata (Punto 6)
    -- 'cancelled': Ordine annullato
    status ENUM('draft', 'confirmed', 'processing', 'delivered', 'cancelled') NOT NULL DEFAULT 'draft',
    
    -- Note opzionali per il coordinatore/produttore
    notes TEXT DEFAULT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    updated_by INT,

    FOREIGN KEY (gas_id) REFERENCES gas(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (cycle_id) REFERENCES cycles(id),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,

    -- INDICI DI PERFORMANCE (Robusteza)
    -- Velocizza: "Dammi la bozza attiva per questo utente in questo ciclo"
    INDEX idx_order_user_cycle (user_id, cycle_id, status),
    -- Velocizza: "Dammi lo storico ordini dell'utente"
    INDEX idx_order_user_history (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    qty_received DECIMAL(10,2) DEFAULT NULL,
    price_at_order DECIMAL(10,2) NOT NULL, -- Nominativo robusto v21.0
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    updated_by INT,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE wallet_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    gas_id INT NOT NULL,
    user_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    type ENUM('DEPOSIT', 'WITHDRAWAL', 'SPESA', 'REFUND') NOT NULL,
    status ENUM('pending', 'completed', 'rejected') DEFAULT 'completed',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    updated_by INT,
    FOREIGN KEY (gas_id) REFERENCES gas(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE holidays (
    id INT PRIMARY KEY AUTO_INCREMENT,
    gas_id INT NOT NULL,
    holiday_date DATE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    updated_by INT,
    FOREIGN KEY (gas_id) REFERENCES gas(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY idx_gas_date (gas_id, holiday_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 5. LOGISTICA OPERATIVA
CREATE TABLE product_units (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    symbol VARCHAR(10) NOT NULL UNIQUE,
    is_discrete TINYINT(1) DEFAULT 0 COMMENT '1 per pezzi/bottiglie (no decimali), 0 per kg/litri',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Popolamento Iniziale Unità
INSERT INTO product_units (name, symbol, is_discrete) VALUES 
('Chilogrammo', 'kg', 0),
('Grammo', 'g', 0),
('Litro', 'L', 0),
('Pezzo', 'pz', 1),
('Bottiglia', 'bt', 1),
('Confezione', 'conf', 1),
('Sacco', 'sac', 1),
('Latta', 'lat', 1),
('Vasetto', 'vas', 1);

-- 6. MESSAGING SYSTEM 
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    gas_id INT NOT NULL,
    user_id INT NOT NULL,
    target_profile ENUM('member', 'coordinator', 'producer') NOT NULL DEFAULT 'member',
    title VARCHAR(255) NOT NULL,
    message TEXT,
    
    -- Tipo di notifica per icone/colori diversi nel frontend
    type ENUM('info', 'success', 'warning', 'alert') DEFAULT 'info',
    
    -- Gestione ACK (Lettura)
    is_read TINYINT(1) DEFAULT 0,
    read_at TIMESTAMP NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (gas_id) REFERENCES gas(id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indice per mostrare velocemente le notifiche non lette in Dashboard
    INDEX idx_notif_user_read (user_id, is_read),
    INDEX idx_notif_profile (user_id, target_profile, is_read);
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabella Template Notifiche (Personalizzabili per GAS)
CREATE TABLE IF NOT EXISTS notification_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    gas_id INT NOT NULL,
    event_key VARCHAR(50) NOT NULL, -- Es: 'G1_OPEN', 'G3_SHOP_OPEN'
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (gas_id) REFERENCES gas(id) ON DELETE CASCADE,
    UNIQUE KEY unique_template (gas_id, event_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Inserimento Template di Default per il GAS ID 1 (Esempio)
-- (In produzione, questo verrebbe fatto alla creazione di un nuovo GAS)
INSERT INTO notification_templates (gas_id, event_key, subject, body) VALUES 
(1, 'G1_OPEN', 'Apertura Listini - {{cycle_name}}', 'Ciao Produttore, è aperta la fase di aggiornamento listini per il ciclo {{cycle_name}}. Hai tempo fino al {{deadline}}.'),
(1, 'G3_SHOP_OPEN', 'Mercato Aperto! 🛒', 'Cari soci, il mercato per {{cycle_name}} è aperto. Chiusura prevista: {{close_date}}.'),
(1, 'G4_REMINDER', '⏳ 3 Ore alla Chiusura', 'Affrettati! Il mercato per {{cycle_name}} chiude tra 3 ore. Controlla il tuo carrello.'),
(1, 'G5_PROD_ORDER', 'Nuovi Ordini da Preparare 📦', 'Gli ordini per {{cycle_name}} sono confermati. Accedi alla dashboard per scaricare la lista di preparazione.');

-- Tabella dei cotnatti
CREATE TABLE leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  message TEXT,
  status VARCHAR(50) DEFAULT 'NEW',
  location VARCHAR(255) NOT NULL ,
  created_at DATETIME
);

-- Tabella dei logs
CREATE TABLE IF NOT EXISTS page_views (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- indice composto per velocizzare il check delle 6 ore
CREATE INDEX idx_pageviews_ip_time ON page_views(ip_address, created_at);

-- Tabella per tracciare la validazione del listino per ogni ciclo
CREATE TABLE producer_cycle_validations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    producer_id INT NOT NULL,
    cycle_id INT NOT NULL,
    is_validated TINYINT(1) DEFAULT 0,
    validated_at DATETIME NULL,
    -- Vincolo: una sola riga per produttore/ciclo
    UNIQUE KEY unq_producer_cycle (producer_id, cycle_id)
);

-- -----------------------------------------------------------------------------
-- 7. Default Data
-- -----------------------------------------------------------------------------


-- Default Admin 
INSERT INTO users (id, first_name, last_name, email, phone) VALUES (1, 'Marco', 'Rossi', 'admin@gas.it', '1234');
INSERT INTO gas_memberships (gas_id, user_id, role_id, balance, created_by) VALUES 
(1, 1, 1, 0.00, 1);

-- GAS
INSERT INTO gas (id, name, slug, description, iban, website, email_contact, created_by) VALUES 
(1, 'GAS Dolifarm Demo', 'demo', 'Gruppo di Acquisto Solidale Ibleo.', 'IT00X1234567890123456789012', 'www.gasdolifarm.com', 'info@dolifarm.com', 1);

INSERT INTO product_categories (id, gas_id, name, created_by) VALUES 
(1, 1, 'Ortofrutta', 1), (2, 1, 'Latticini', 1), (3, 1, 'Forno', 1), (4, 1, 'Bevande', 1);