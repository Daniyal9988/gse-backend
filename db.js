require('dotenv').config();
const mysql = require('mysql2');

// MySQL Database Connection Pool using environment variables
const db = mysql.createPool({
    host: process.env.DB_HOST || '50.6.43.53',
    user: process.env.DB_USER || 'mxkdpnmy_dany',
    password: process.env.DB_PASSWORD || 'DanyGseSql2021',        
    database: process.env.DB_NAME || 'mxkdpnmy_gse_database',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
module.exports = db.promise();