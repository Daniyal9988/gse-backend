const XLSX = require('xlsx');
const db = require('./server'); // Imports the db pool directly from your server.js

const workbook = XLSX.readFile('GSEPriceDatabase.xlsx');
const sheetName = workbook.SheetNames[0];
const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

async function runImport() {
    try {
        console.log("Creating tables if they don't exist...");

        // 1. Create clients table
        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS clients (
                id INT AUTO_INCREMENT PRIMARY KEY,
                client_name VARCHAR(255) NOT NULL UNIQUE,
                contact_person VARCHAR(255) NULL,
                phone_number VARCHAR(50) NULL
            )
        `);

        // 2. Create pricing matrix table
        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS product_client_prices (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                client_id INT NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                UNIQUE KEY unique_product_client (product_id, client_id)
            )
        `);

        console.log("Tables ready. Importing matrix data from Excel...");

        for (const row of data) {
            const itemCode = row['Code'];
            if (!itemCode) continue;

            // Find product ID using your existing columns (item_code)
            const [productRows] = await db.promise().query(
                'SELECT id FROM products WHERE item_code = ?', 
                [itemCode]
            );

            if (productRows.length === 0) {
                console.warn(`Product code ${itemCode} not found in products table. Skipping.`);
                continue;
            }

            const productId = productRows[0].id;

            // Loop through column headers to grab each client name and price
            for (const [key, value] of Object.entries(row)) {
                if (['Code', 'Description', 'Standard', 'N/A', undefined, null].includes(key)) continue;
                
                const clientName = key.trim();
                if (!clientName) continue;

                // Insert client or get existing ID
                const [clientResult] = await db.promise().query(
                    `INSERT INTO clients (client_name) VALUES (?) 
                     ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
                    [clientName]
                );
                
                // Get the client's ID (handles both new insertions and existing IDs)
                const [getClient] = await db.promise().query(
                    'SELECT id FROM clients WHERE client_name = ?', 
                    [clientName]
                );
                const clientId = getClient[0].id;

                // Handle missing or invalid matrix values
                const price = (value !== undefined && !isNaN(value)) ? value : 0;

                // Insert or update pricing matrix row
                await db.promise().query(
                    `INSERT INTO product_client_prices (product_id, client_id, price) 
                     VALUES (?, ?, ?) 
                     ON DUPLICATE KEY UPDATE price = ?`,
                    [productId, clientId, price, price]
                );
            }
        }

        console.log("All clients and price matrices successfully imported into MySQL!");
        process.exit(0);
    } catch (err) {
        console.error("Import failed:", err);
        process.exit(1);
    }
}

runImport();