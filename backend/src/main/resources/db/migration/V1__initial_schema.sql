CREATE TABLE venue (
  id VARCHAR(36) PRIMARY KEY, name VARCHAR(160) NOT NULL, phone VARCHAR(40), email VARCHAR(200), address VARCHAR(500),
  currency VARCHAR(8) NOT NULL DEFAULT 'INR', timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Kolkata',
  operating_hours VARCHAR(500), tax_rate DECIMAL(6,3) NOT NULL DEFAULT 0, enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE app_user (
  id VARCHAR(36) PRIMARY KEY, venue_id VARCHAR(36) NOT NULL REFERENCES venue(id), full_name VARCHAR(160) NOT NULL,
  email VARCHAR(200) NOT NULL, password_hash VARCHAR(255) NOT NULL, role VARCHAR(24) NOT NULL CHECK(role IN ('OWNER','MANAGER','RECEPTIONIST','STAFF')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(venue_id,email)
);
CREATE TABLE customer (
  id VARCHAR(36) PRIMARY KEY, venue_id VARCHAR(36) NOT NULL REFERENCES venue(id), full_name VARCHAR(160) NOT NULL,
  phone VARCHAR(40) NOT NULL, email VARCHAR(200), notes VARCHAR(2000), visits INTEGER NOT NULL DEFAULT 0,
  total_spend DECIMAL(12,2) NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(venue_id,phone)
);
CREATE TABLE resource_category (
  id VARCHAR(36) PRIMARY KEY, venue_id VARCHAR(36) NOT NULL REFERENCES venue(id), name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(venue_id,name)
);
CREATE TABLE resource (
  id VARCHAR(36) PRIMARY KEY, venue_id VARCHAR(36) NOT NULL REFERENCES venue(id), category_id VARCHAR(36) REFERENCES resource_category(id),
  name VARCHAR(120) NOT NULL, status VARCHAR(24) NOT NULL CHECK(status IN ('AVAILABLE','OCCUPIED','MAINTENANCE','DISABLED')),
  active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(venue_id,name)
);
CREATE TABLE pricing_rule (
  id VARCHAR(36) PRIMARY KEY, venue_id VARCHAR(36) NOT NULL REFERENCES venue(id), resource_id VARCHAR(36) REFERENCES resource(id),
  name VARCHAR(120) NOT NULL, rate_per_hour DECIMAL(10,2) NOT NULL CHECK(rate_per_hour >= 0), minimum_minutes INTEGER NOT NULL DEFAULT 30,
  starts_at TIME, ends_at TIME, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE booking (
  id VARCHAR(36) PRIMARY KEY, venue_id VARCHAR(36) NOT NULL REFERENCES venue(id), customer_id VARCHAR(36) NOT NULL REFERENCES customer(id),
  resource_id VARCHAR(36) NOT NULL REFERENCES resource(id), starts_at TIMESTAMP NOT NULL, ends_at TIMESTAMP NOT NULL,
  status VARCHAR(24) NOT NULL CHECK(status IN ('CONFIRMED','CANCELLED','COMPLETED','NO_SHOW')),
  notes VARCHAR(1000), created_by VARCHAR(36) REFERENCES app_user(id), created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(ends_at > starts_at)
);
CREATE TABLE parlour_session (
  id VARCHAR(36) PRIMARY KEY, venue_id VARCHAR(36) NOT NULL REFERENCES venue(id), customer_id VARCHAR(36) NOT NULL REFERENCES customer(id),
  resource_id VARCHAR(36) NOT NULL REFERENCES resource(id), pricing_rule_id VARCHAR(36) REFERENCES pricing_rule(id),
  started_at TIMESTAMP NOT NULL, expected_end_at TIMESTAMP, ended_at TIMESTAMP, status VARCHAR(24) NOT NULL CHECK(status IN ('ACTIVE','COMPLETED','VOID')),
  discount DECIMAL(10,2) NOT NULL DEFAULT 0, base_amount DECIMAL(10,2), final_amount DECIMAL(10,2), created_by VARCHAR(36) REFERENCES app_user(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(ended_at IS NULL OR ended_at >= started_at)
);
CREATE TABLE parlour_transaction (
  id VARCHAR(36) PRIMARY KEY, venue_id VARCHAR(36) NOT NULL REFERENCES venue(id), session_id VARCHAR(36) NOT NULL REFERENCES parlour_session(id),
  amount DECIMAL(10,2) NOT NULL CHECK(amount >= 0), discount DECIMAL(10,2) NOT NULL DEFAULT 0, tax DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL CHECK(total >= 0), created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE payment (
  id VARCHAR(36) PRIMARY KEY, venue_id VARCHAR(36) NOT NULL REFERENCES venue(id), transaction_id VARCHAR(36) NOT NULL REFERENCES parlour_transaction(id),
  amount DECIMAL(10,2) NOT NULL CHECK(amount > 0), method VARCHAR(20) NOT NULL CHECK(method IN ('CASH','UPI','CARD','OTHER')),
  status VARCHAR(20) NOT NULL CHECK(status IN ('PAID','REFUNDED')), reference VARCHAR(160), received_by VARCHAR(36) REFERENCES app_user(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE staff (
  id VARCHAR(36) PRIMARY KEY, venue_id VARCHAR(36) NOT NULL REFERENCES venue(id), user_id VARCHAR(36) NOT NULL UNIQUE REFERENCES app_user(id),
  title VARCHAR(100), active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE maintenance_block (
  id VARCHAR(36) PRIMARY KEY, venue_id VARCHAR(36) NOT NULL REFERENCES venue(id), resource_id VARCHAR(36) NOT NULL REFERENCES resource(id),
  starts_at TIMESTAMP NOT NULL, ends_at TIMESTAMP NOT NULL, reason VARCHAR(500), active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, CHECK(ends_at > starts_at)
);
CREATE TABLE audit_log (
  id VARCHAR(36) PRIMARY KEY, venue_id VARCHAR(36) NOT NULL REFERENCES venue(id), actor_id VARCHAR(36) REFERENCES app_user(id),
  action VARCHAR(100) NOT NULL, entity VARCHAR(80) NOT NULL, entity_id VARCHAR(36), old_value TEXT, new_value TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_customer_venue_name ON customer(venue_id,full_name);
CREATE INDEX idx_booking_resource_time ON booking(venue_id,resource_id,starts_at,ends_at,status);
CREATE INDEX idx_session_resource_status ON parlour_session(venue_id,resource_id,status);
CREATE INDEX idx_session_customer_time ON parlour_session(venue_id,customer_id,started_at);
CREATE INDEX idx_payment_venue_time ON payment(venue_id,created_at);
CREATE INDEX idx_audit_venue_time ON audit_log(venue_id,created_at);
