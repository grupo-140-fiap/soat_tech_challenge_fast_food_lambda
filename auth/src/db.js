const mysql = require('mysql2/promise');

let pool = null;

/**
 * Get or create MySQL connection pool
 */
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });
  }
  return pool;
}

/**
 * Query customer by CPF
 * @param {string} cpf - Customer CPF
 * @returns {Promise<Object|null>} Customer data or null
 */
async function queryCustomerByCPF(cpf) {
  const pool = getPool();
  
  try {
    const [rows] = await pool.execute(
      'SELECT id, first_name, last_name, cpf, email, created_at, updated_at FROM customers WHERE cpf = ?',
      [cpf]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    return {
      id: rows[0].id,
      firstName: rows[0].first_name,
      lastName: rows[0].last_name,
      cpf: rows[0].cpf,
      email: rows[0].email,
      createdAt: rows[0].created_at,
      updatedAt: rows[0].updated_at
    };
  } catch (error) {
    console.error('Error querying customer by CPF:', error);
    throw error;
  }
}

/**
 * Close database connection pool
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  queryCustomerByCPF,
  closePool
};