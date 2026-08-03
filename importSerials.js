const XLSX = require('xlsx');
const db = require('./db');

const workbook = XLSX.readFile('GSESerialDatabase.xlsx');
const sheetName = workbook.SheetNames[0];
const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

async function runSerialImport() {
    try {
        console.log(`Loaded ${data.length} rows from Excel sheet: "${sheetName}"`);
        
        console.log("Ensuring inventory_stock table exists...");
        await db.query(`
            CREATE TABLE IF NOT EXISTS inventory_stock (
              id INT AUTO_INCREMENT PRIMARY KEY,
              item_code VARCHAR(50) NOT NULL,
              serial_number VARCHAR(100) NOT NULL UNIQUE,
              status ENUM('Unsold', 'Sold') DEFAULT 'Unsold',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              INDEX idx_status_code (status, item_code),
              INDEX idx_serial (serial_number)
            ) ENGINE=InnoDB;
        `);

        console.log("Table ready. Importing serial numbers matrix from Excel...");

        let importedCount = 0;
        let skippedCount = 0;

        for (const row of data) {
            // Each key in the row object is an item code, and its value is the serial number for that row
            for (const [itemCode, serialNumber] of Object.entries(row)) {
                if (!itemCode || !serialNumber) continue;

                const cleanItemCode = String(itemCode).trim();
                const cleanSerial = String(serialNumber).trim();

                // Skip placeholder text or headers if any
                if (cleanSerial === '' || cleanSerial.toLowerCase() === 'undefined' || cleanSerial.toLowerCase() === 'null') {
                    continue;
                }

                // Verify that the product code exists in the products table
                const [productRows] = await db.query(
                    'SELECT id FROM products WHERE item_code = ?', 
                    [cleanItemCode]
                );

                if (productRows.length === 0) {
                    if (skippedCount < 5) {
                        console.warn(`Product code "${cleanItemCode}" not found in products table. Skipping serial ${cleanSerial}.`);
                    }
                    skippedCount++;
                    continue;
                }

                // Insert serial stock or update if it already exists
                await db.query(
                    `INSERT INTO inventory_stock (item_code, serial_number, status) 
                     VALUES (?, ?, 'Unsold') 
                     ON DUPLICATE KEY UPDATE item_code = VALUES(item_code)`,
                    [cleanItemCode, cleanSerial]
                );

                importedCount++;
            }
        }

        console.log(`Serial matrix import finished! Imported/Updated: ${importedCount}, Skipped: ${skippedCount}`);
        process.exit(0);
    } catch (err) {
        console.error("Serial import failed:", err);
        process.exit(1);
    }
}

runSerialImport();