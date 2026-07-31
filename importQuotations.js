require('dotenv').config();
const XLSX = require('xlsx');
const mysql = require('mysql2/promise');

// Create a direct promise-based pool using your .env credentials
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
});

const workbook = XLSX.readFile('QuotationData.xlsx');
const sheetName = 'QuotationRecords';
const worksheet = workbook.Sheets[sheetName];

if (!worksheet) {
    console.error(`Sheet "${sheetName}" not found in the workbook.`);
    process.exit(1);
}

const data = XLSX.utils.sheet_to_json(worksheet);

async function runQuotationImport() {
    try {
        console.log(`Found ${data.length} quotation records. Starting import into MySQL...`);

        for (const row of data) {
            let rawDate = row['Date'];
            let formattedDate = null;

            if (rawDate) {
                if (typeof rawDate === 'number') {
                    const utcDays = Math.floor(rawDate - 25569);
                    const utcValue = utcDays * 86400;
                    const dateInfo = new Date(utcValue * 1000);
                    formattedDate = dateInfo.toISOString().split('T')[0];
                } else {
                    formattedDate = new Date(rawDate).toISOString().split('T')[0];
                }
            }

            const quotationNo = row['QuotationNo'];
            if (!quotationNo) continue;

            const clientName = row['ClientName'] || 'Unknown';
            const contactPerson = row['ContactPerson'] || null;
            const contactNo = row['ContactNo'] ? String(row['ContactNo']) : null;
            const subtotal = row['Subtotal'] || 0;
            const vat = row['VAT'] || 0;
            const total = row['Total'] || 0;
            const itemsJson = typeof row['ItemsJSON'] === 'string' 
                ? row['ItemsJSON'] 
                : JSON.stringify(row['ItemsJSON'] || []);
            const createdBy = row['CreatedBy'] || 'admin';

            // Uses direct db.query since this pool natively supports promises
            await db.query(
                `INSERT INTO quotations 
                (QuotationNo, ClientName, ContactPerson, ContactNo, Date, Subtotal, VAT, Total, ItemsJSON, CreatedBy) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                ClientName = VALUES(ClientName),
                ContactPerson = VALUES(ContactPerson),
                ContactNo = VALUES(ContactNo),
                Date = VALUES(Date),
                Subtotal = VALUES(Subtotal),
                VAT = VALUES(VAT),
                Total = VALUES(Total),
                ItemsJSON = VALUES(ItemsJSON),
                CreatedBy = VALUES(CreatedBy)`,
                [
                    quotationNo, 
                    clientName, 
                    contactPerson, 
                    contactNo, 
                    formattedDate, 
                    subtotal, 
                    vat, 
                    total, 
                    itemsJson, 
                    createdBy
                ]
            );
        }

        console.log("All quotation records successfully imported into the MySQL database!");
        await db.end();
        process.exit(0);
    } catch (err) {
        console.error("Quotation import failed:", err);
        await db.end();
        process.exit(1);
    }
}

runQuotationImport();