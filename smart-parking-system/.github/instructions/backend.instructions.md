---
description: "Use when: editing backend code (backend/** files). Provides Node.js/Express/SQLite guidance with REST API patterns, MQTT pub/sub best practices, database optimization, and production patterns."
applyTo: "backend/**"
---

# Backend-Specific Instructions

## 🎯 Context

You are working on **Node.js Express backend** for a smart parking system API server.

**Key Characteristics:**
- **Language**: JavaScript (Node.js v14+)
- **Framework**: Express.js (HTTP REST API)
- **Database**: SQLite3 (single-file, ACID transactions)
- **Communication**: MQTT pub/sub (async event-driven)
- **Runtime**: Single-threaded event loop with async I/O

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│  Express Server (HTTP REST API)                     │
│  - Health checks                                     │
│  - Parking endpoints                                 │
│  - Admin operations                                  │
└──────────────┬──────────────────────────────────────┘
               │ HTTP (REST)
        ┌──────┴──────┐
        ↓             ↓
    Clients      Frontend Dashboard
        
┌─────────────────────────────────────────────────────┐
│  MQTT Pub/Sub (Event-Driven)                        │
│  - Subscribe: rfid/scan from firmware               │
│  - Publish: control/* commands to firmware          │
└──────────────┬──────────────────────────────────────┘
               │ MQTT
        ┌──────┴──────┐
        ↓             ↓
      ESP32s         MQTT Broker
      
┌─────────────────────────────────────────────────────┐
│  SQLite Database (Transactions)                     │
│  - users (RFID cards + balance)                     │
│  - parking_sessions (entry/exit records)            │
│  - transactions (audit log)                         │
│  - device_status (device monitoring)                │
└─────────────────────────────────────────────────────┘
```

## 📁 Key Files & Responsibilities

| File | Purpose | Pattern |
|------|---------|---------|
| `server.js` | Express app setup, MQTT init | Starts all services |
| `services/parking.service.js` | Business logic (entry/exit/fee) | Pure functions, no side effects |
| `mqtt/publisher.js` | Publish to ESP32 | Centralized, async (doesn't wait) |
| `mqtt/subscriber.js` | Handle messages from ESP32 | Async, calls parking.service |
| `api/routes/parking.routes.js` | Route definitions | Declarative, 11 endpoints |
| `api/controllers/parking.controller.js` | Request handlers | Request → Service → Response |
| `database/db.js` | Promise-based DB wrapper | All queries return Promises |
| `database/init.js` | Schema creation | Runs once at startup |

## 🔐 Database Design

### Table: users
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  rfid_uid TEXT UNIQUE NOT NULL,      -- ← Index this
  name TEXT,
  email TEXT,
  initial_balance REAL DEFAULT 500,
  current_balance REAL,               -- ← Updated on entry/exit
  status TEXT DEFAULT 'active',       -- ← Index this
  created_at DATETIME,
  updated_at DATETIME
);
-- Indexes: rfid_uid (unique), status
```

### Table: parking_sessions
```sql
CREATE TABLE parking_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,              -- ← Foreign key
  rfid_uid TEXT NOT NULL,
  entry_time DATETIME NOT NULL,       -- ← Index this
  exit_time DATETIME,
  duration_minutes INTEGER,
  parking_fee REAL,
  balance_before REAL,
  balance_after REAL,
  estimated_fee REAL,
  status TEXT DEFAULT 'ACTIVE',       -- ← Index this
  created_at DATETIME,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
-- Indexes: user_id, status, entry_time
```

### Table: transactions
```sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,              -- ← Foreign key
  session_id TEXT,                    -- ← Foreign key (nullable)
  transaction_type TEXT NOT NULL,     -- ENTRY, EXIT, TOPUP, REFUND
  amount REAL NOT NULL,
  balance_before REAL,
  balance_after REAL,
  description TEXT,
  created_at DATETIME,                -- ← Index this
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(session_id) REFERENCES parking_sessions(id)
);
-- Indexes: user_id, created_at
```

**Critical**: All FKs have indexes, status fields indexed for filtering.

## 💰 Parking Logic Flow

### Entry Flow (processEntry)

```javascript
async processEntry(rfid_uid, location_id) {
  1. Get user by UID
     → If not found → DENIED (UNREGISTERED_CARD)
  
  2. Check if already parked
     → If yes → DENIED (ALREADY_PARKED)
  
  3. Calculate estimated fee (8-hour worst case = ₹81)
  
  4. Check balance ≥ estimated fee
     → If no → DENIED (INSUFFICIENT_BALANCE)
  
  5. Create parking_session (status: ACTIVE)
     → session_id = UUID
     → entry_time = now
  
  6. Deduct balance: current_balance -= estimated_fee
     → UPDATE users SET current_balance = ?
  
  7. Log transaction: type='ENTRY', amount=₹81
  
  8. Return APPROVED with new balance
  
  9. Frontend shows: Green LED + 2 beeps + "ENTRY OK"
}
```

### Exit Flow (processExit)

```javascript
async processExit(rfid_uid) {
  1. Get user by UID
     → If not found → DENIED
  
  2. Get active session
     → If not found → DENIED (NO_ACTIVE_SESSION)
  
  3. Calculate actual fee
     → duration_minutes = (now - entry_time) / 60000
     → fee = calculateFee(duration_minutes)
  
  4. Calculate refund
     → refund = estimated_fee - actual_fee
  
  5. Update balance: current_balance += refund
     → UPDATE users SET current_balance = ?
  
  6. Complete session
     → UPDATE parking_sessions SET
       exit_time = now,
       duration_minutes = ?,
       parking_fee = ?,
       balance_after = ?,
       status = 'COMPLETED'
  
  7. Log transaction: type='EXIT', amount=actual_fee
  
  8. Return APPROVED with fee & new balance
  
  9. Frontend shows: "EXIT OK | Fee: ₹40 | Balance: ₹470"
}
```

**Key Insight**: Entry holds money, exit refunds. Ensures balance never goes negative.

## 📡 MQTT Patterns

### Publishing (Centralized in publisher.js)

```javascript
// ✅ GOOD: Centralized, async, returns boolean
publishAccessResponse(device_id, parkingResponse) {
  if (status === 'APPROVED') {
    publishLEDControl(device_id, 'grant', 'green', 3);
    publishBuzzerControl(device_id, 'grant', 2, 500);
    publishDisplayUpdate(device_id, line1, line2, 3);
  } else {
    publishLEDControl(device_id, 'deny', 'red', 3);
    publishBuzzerControl(device_id, 'deny', 4, 300);
  }
}

// ❌ AVOID: Direct client.publish() scattered everywhere
// Reason: Hard to test, hard to change format, no centralization
```

### Subscribing (Centralized in subscriber.js)

```javascript
// ✅ Pattern: Topic → Handler mapping
const handleMessage = async (topic, message, client) => {
  if (topic.includes('rfid/scan')) {
    return handleRFIDScan(topic, message);
  } else if (topic.includes('status/online')) {
    return handleDeviceStatus(topic, message);
  }
  // Explicit handlers = easy to modify + test
}

// ❌ AVOID: Giant switch statement
// Reason: Hard to add new handlers, hard to test
```

## 🔌 REST API Patterns

### Endpoint Structure

```javascript
// ✅ GOOD: RESTful resource-oriented
GET    /api/parking/active              Get resource
GET    /api/parking/users/{uid}/balance Get related resource
POST   /api/parking/users/{uid}/topup   Create/update action
GET    /api/parking/sessions/{id}       Get resource by ID

// ❌ AVOID: Action-oriented verbs in paths
GET    /api/parking/get-active
POST   /api/parking/do-topup
```

### Error Handling

```javascript
// ✅ GOOD: Consistent error structure
return res.status(404).json({
  success: false,
  message: 'User not found',
  code: 'USER_NOT_FOUND'
});

// ✅ GOOD: Appropriate HTTP status
200 OK              Success
400 Bad Request     Invalid input
404 Not Found       Resource missing
409 Conflict        Logic error (insufficient balance)
500 Server Error    Unexpected exception

// ❌ AVOID: Business logic in HTTP status
// "409 Conflict" is correct for insufficient balance
// NOT "400 Bad Request" (input was valid)
```

### Request Validation

```javascript
// ✅ Pattern: Joi validation (already imported)
const schema = Joi.object({
  amount: Joi.number().min(1).required(),
  reason: Joi.string().optional()
});

const { error, value } = schema.validate(req.body);
if (error) return res.status(400).json({ success: false, message: error.message });

// ✅ Then use: value.amount, value.reason
// Reason: Type-safe, consistent validation, auto-sanitized
```

## 💾 Database Patterns

### Promise-Based Queries

```javascript
// ✅ GOOD: Always use db.js wrapper
const user = await dbGet('SELECT * FROM users WHERE rfid_uid = ?', [uid]);

// ✅ GOOD: Promise chains
try {
  const user = await dbGet(...);
  const sessions = await dbAll(...);
} catch (error) {
  logger.error('Query failed:', error);
}

// ❌ AVOID: Callback hell
db.get(..., (err, row) => {
  if (err) {...}
  db.all(..., (err, rows) => {...})
})
```

### Transactions (Multi-Step Operations)

```javascript
// ✅ GOOD: Transaction pattern for consistency
async processEntry(rfid_uid) {
  try {
    const user = await dbGet('SELECT * FROM users WHERE rfid_uid = ?', [uid]);
    
    // Step 1: Create session
    const sessionId = await dbRun('INSERT INTO parking_sessions ...', [...]);
    
    // Step 2: Deduct balance (must succeed with step 1)
    await dbRun('UPDATE users SET current_balance = ?', [newBalance]);
    
    // Step 3: Log transaction
    await dbRun('INSERT INTO transactions ...', [...]);
    
    // All succeeded → commit implicitly
    return { status: 'APPROVED', sessionId };
  } catch (error) {
    // All rolled back implicitly (SQLite auto-rolls on error)
    logger.error('Entry failed:', error);
    return { status: 'ERROR' };
  }
}

// Why: If step 2 fails, step 1 is still in DB = inconsistent state
// Solution: Use atomic operations or explicit transactions
```

### Indexing for Performance

```sql
-- ✅ Good queries (use indexes):
SELECT * FROM users WHERE rfid_uid = 'A1B2C3D4';     -- Index on rfid_uid
SELECT * FROM parking_sessions WHERE status = 'ACTIVE'; -- Index on status
SELECT * FROM transactions WHERE created_at > ?;    -- Index on created_at

-- ❌ Bad queries (full table scan):
SELECT * FROM users WHERE name = 'Demo User 1';     -- No index
SELECT * FROM parking_sessions WHERE parking_fee > 50; -- No index

-- Always index WHERE, ORDER BY, GROUP BY, JOIN columns
```

## ⚡ Performance Optimization

### Caching Strategy (Future)

```javascript
// ✅ Pattern: Cache user balance
const userCache = new Map();

async getUserBalance(uid) {
  if (userCache.has(uid)) {
    return userCache.get(uid); // < 1ms
  }
  
  const user = await dbGet(...); // ~ 10ms
  userCache.set(uid, user.current_balance);
  
  // Invalidate on change
  return user.current_balance;
}

// Invalidate after entry/exit
userCache.delete(uid); // Next query will fetch fresh
```

### Connection Pooling (Future, if using PostgreSQL)

```javascript
// ✅ Pattern: Reuse connections
const pool = new Pool({
  max: 20,        // Max 20 connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// SQLite: Single connection (file-based), no pooling needed
```

## 🔒 Security Best Practices

### Input Validation

```javascript
// ✅ GOOD: Use Joi for all inputs
const schema = Joi.object({
  uid: Joi.string().length(8).alphanumeric().required(),
  amount: Joi.number().positive().max(10000).required()
});

// ❌ AVOID: No validation
const { uid, amount } = req.body; // Could be anything
```

### SQL Injection Prevention

```javascript
// ✅ GOOD: Use parameterized queries
dbGet('SELECT * FROM users WHERE rfid_uid = ?', [uid]);

// ❌ AVOID: String concatenation
dbGet(`SELECT * FROM users WHERE rfid_uid = '${uid}'`); // DANGER!
// If uid = "'; DROP TABLE users; --" → Database deleted
```

### Rate Limiting

```javascript
// Already implemented in server.js
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100                    // 100 requests per IP
});

app.use(limiter); // Applied globally
// ✅ Prevents brute force, DDoS
```

## 🧪 Testing Patterns

### Unit Test (Service Logic)

```javascript
// ✅ GOOD: Test business logic in isolation
describe('parking.service', () => {
  test('processEntry - sufficient balance', async () => {
    const result = await parkingService.processEntry('A1B2C3D4');
    expect(result.status).toBe('APPROVED');
    expect(result.balance_after).toBe(419); // 500 - 81
  });
  
  test('processEntry - insufficient balance', async () => {
    // Mock user with balance < 81
    const result = await parkingService.processEntry('B2C3D4E5');
    expect(result.status).toBe('DENIED');
  });
});

// Why: Service = pure functions = easy to test
```

### Integration Test (API + Database)

```javascript
// ✅ GOOD: Test full flow
describe('POST /api/parking/users/:uid/topup', () => {
  test('should add balance', async () => {
    const response = await request(app)
      .post('/api/parking/users/A1B2C3D4/topup')
      .send({ amount: 100, reason: 'Testing' });
    
    expect(response.status).toBe(200);
    expect(response.body.data.new_balance).toBe(600);
  });
});

// Why: Catches DB errors, MQTT failures, full stack issues
```

## 📊 Monitoring & Logging

### Structured Logging

```javascript
// ✅ GOOD: Contextual logging
logger.info('Entry processed', {
  uid: 'A1B2C3D4',
  status: 'APPROVED',
  balance_before: 500,
  balance_after: 419,
  timestamp: new Date().toISOString()
});

// ✅ Can later feed to ELK, Splunk, DataDog, etc.
// Easy to search: { status: 'DENIED', reason: 'INSUFFICIENT_BALANCE' }

// ❌ AVOID: Unstructured strings
console.log('User scanned card with insufficient balance');
// Hard to search, hard to aggregate, hard to analyze
```

### Metrics to Track

```javascript
// ✅ Metrics to expose (e.g., Prometheus)
- parking_sessions_total           (Counter: entries + exits)
- parking_duration_minutes         (Histogram: session length)
- parking_fee_rupees              (Histogram: fees charged)
- user_balance_rupees             (Gauge: current balances)
- api_request_duration_ms         (Histogram: response times)
- mqtt_publish_failures           (Counter: failed publishes)
```

## 🚀 Deployment Patterns

### Environment Configuration

```env
# .env (dev)
NODE_ENV=development
PORT=3000
MQTT_BROKER_URL=mqtt://localhost:1883
DATABASE_PATH=./data/parking.db

# .env.production (prod)
NODE_ENV=production
PORT=3000
MQTT_BROKER_URL=mqtt://emqx-cloud.example.com:1883
MQTT_USERNAME=prod_user
MQTT_PASSWORD=secure_password
DATABASE_PATH=/var/lib/parking/parking.db

# ✅ Secrets: NEVER commit passwords
# ✅ Use: process.env.MQTT_USERNAME
```

### Graceful Shutdown

```javascript
// ✅ Pattern: Close connections on exit
const shutdown = async () => {
  console.log('Shutting down...');
  
  // 1. Stop accepting new requests
  server.close();
  
  // 2. Close MQTT
  client.end();
  
  // 3. Close database
  db.close();
  
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Why: Prevents data corruption, lost messages, orphaned connections
```

## ✅ Pre-Commit Checklist

Before pushing backend changes:

- [ ] All SQL uses parameterized queries (no string concat)
- [ ] Database indexes applied for WHERE/ORDER/JOIN
- [ ] MQTT publishing centralized in publisher.js
- [ ] Error responses use correct HTTP status codes
- [ ] Input validation with Joi for all endpoints
- [ ] Async/await used consistently (no callbacks)
- [ ] No sensitive data in logs
- [ ] Rate limiting active
- [ ] CORS configured correctly
- [ ] Tests pass: `npm test`
- [ ] No console.log, use logger
- [ ] No hardcoded credentials

## 🎓 Anti-Patterns (Avoid These)

❌ **Blocking database calls in middleware**
```javascript
app.use((req, res, next) => {
  const user = db.get(...); // Synchronous - blocks entire request!
  next();
});
```

✅ **Async middleware**
```javascript
app.use(async (req, res, next) => {
  const user = await dbGet(...); // Non-blocking
  next();
});
```

---

❌ **Publishing directly in controller**
```javascript
exports.processEntry = async (req, res) => {
  // ... logic ...
  client.publish('parking/esp32/device1/control/display', '...');
};
```

✅ **Centralized publishing**
```javascript
exports.processEntry = async (req, res) => {
  const result = await parkingService.processEntry(req.body.uid);
  await publishAccessResponse(device_id, result);
};
```

---

❌ **Silent failures**
```javascript
dbRun('INSERT INTO transactions ...')
  .catch(err => console.log('error')); // Swallowed!
```

✅ **Explicit error handling**
```javascript
try {
  await dbRun('INSERT INTO transactions ...');
} catch (error) {
  logger.error('Transaction failed:', error);
  res.status(500).json({ success: false, message: 'Internal error' });
}
```

---

## 📈 Scaling Notes

### For 1-10 Devices
- Current SQLite setup: Fine
- Single server with MQTT + Express: Good enough
- Response times: < 100ms per request

### For 100+ Devices
- Migrate to PostgreSQL
- Add Redis caching for user balances
- Use message queue (Bull/RabbitMQ) for heavy operations
- Load balancing (nginx) in front of multiple backend instances
- Separate MQTT broker (EMQX cluster)

---

**Backend is production-ready at current scale.** Track metrics, monitor logs, scale incrementally. ✓
