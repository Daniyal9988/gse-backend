const XLSX = require('xlsx');
const db = require('./server'); // Imports your database pool directly from server.js

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
            // Map Excel serial date or string date to proper SQL format if needed, 
            // or use row['Date'] directly depending on how sheet_to_json parses it.
            let rawDate = row['Date'];
            let formattedDate = null;

            if (rawDate) {
                // If Excel date is a number (serial), convert it, otherwise use string
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

            // Insert or update quotation record based on unique QuotationNo
            await db.promise().query(
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
        process.exit(0);
    } catch (err) {
        console.error("Quotation import failed:", err);
        process.exit(1);
    }
}

runQuotationImport();