const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const vendorDir = 'd:/TOI_Admin_Data/TOI Vendor Details';

// Helper to clean names: remove excessive dots, commas, leading/trailing whitespace
function cleanName(raw) {
  if (!raw) return '';
  let cleaned = raw
    .replace(/[,\t]+/g, ' ')
    .replace(/\.+/g, '.') // collapse multiple dots
    .replace(/\s+/g, ' ')
    .trim();
  // If ends with trailing dot like "Rinta..Ms...", make it clean
  cleaned = cleaned.replace(/\s*\.+\s*$/, '');
  return cleaned;
}

// Helper to clean address: remove excessive commas, fix spacing
function cleanAddress(raw) {
  if (!raw) return '';
  return raw
    .replace(/,{2,}/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+Royapuram/i, '')
    .trim()
    .replace(/,\s*$/, '');
}

// Convert DD.MM.YYYY or DD-MM-YYYY to YYYY-MM-DD
// Convert DD.MM.YYYY, DD-MM-YYYY or DD/MM/YYYY to YYYY-MM-DD
function parseDate(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.trim().match(/^(\d{2})[.\/\-](\d{2})[.\/\-](\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return dateStr;
}

// Detect if a string is an address line rather than a name line
function isAddressLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Patterns that unambiguously denote address starting lines:
  // Numbers with slashes or dashes: 93/1, No.9/5, No 61/3, 90/164, 46157, 22129, 6/A11
  // Or keywords: No, No., Plot, Flat, Door, Old No, New No, Site, Shop, etc. followed by digits or letters
  // Or pincode patterns: 600013, 600021, etc.
  // Or contains multiple consecutive commas: ',,,,,,'
  if (/,{2,}/.test(trimmed)) return true;
  if (/\b600\d{3}\b/.test(trimmed)) return true;
  if (/^(no[\.\s]|plot|flat|door|old\s*no|new\s*no|shop|d\.?no)/i.test(trimmed)) {
    // Check if it's a name like "Noorudin"
    if (/^noor/i.test(trimmed)) return false;
    return true;
  }
  // Line starting with digits like "93/1", "46157", "6/A11", "22129", "25"
  if (/^\d+[\/\-A-Za-z0-9]*,?/.test(trimmed)) {
    return true;
  }
  // Address keywords
  if (/\b(street|road|st|rd|lane|nagar|colony|arcade|floor|washerm|royapuram|tondiarpet)\b/i.test(trimmed)) {
    return true;
  }

  return false;
}

async function parseAll() {
  const files = fs.readdirSync(vendorDir).filter(f => f.endsWith('.pdf'));
  console.log(`Found ${files.length} vendor PDF files.`);

  const allRecords = [];
  const vendorSummary = {};

  for (const file of files) {
    const vendorBase = file.replace(/\.pdf$/i, '').trim();
    const filePath = path.join(vendorDir, file);
    const buf = fs.readFileSync(filePath);
    const parser = new PDFParse(new Uint8Array(buf));
    const parsed = await parser.getText();

    let fullText = '';
    for (const page of parsed.pages) {
      fullText += page.text + '\n';
    }

    // Split into lines
    const rawLines = fullText.split('\n');

    // Find record boundaries
    // A record begins with: optional whitespace, a number (1-999), tab/space, coupon code (SCT... or SCF...), dates
    const recordHeaderRegex = /^\s*(\d+)\s+([A-Z0-9]+)\s+(\d{2}[.\/\-]\d{2}[.\/\-]\d{4})\s+(\d{2}[.\/\-]\d{2}[.\/\-]\d{4})(.*)$/;

    const chunks = [];
    let currentChunk = null;

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const match = line.match(recordHeaderRegex);

      if (match) {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = {
          sNo: match[1],
          couponNo: match[2],
          startDate: match[3],
          expiryDate: match[4],
          remainder: match[5] ? match[5].trim() : '',
          lines: [],
          file: file,
          vendorBase: vendorBase,
        };
      } else if (currentChunk) {
        // Stop chunk if header of table or page footer
        if (line.includes('S.No') && line.includes('Coupon No')) {
          // ignore table header
        } else {
          currentChunk.lines.push(line);
        }
      }
    }
    if (currentChunk) {
      chunks.push(currentChunk);
    }

    vendorSummary[vendorBase] = chunks.length;

    // Now process each chunk
    for (const chunk of chunks) {
      // We have remainder from header line and chunk.lines
      const lines = [];
      if (chunk.remainder) {
        lines.push(chunk.remainder);
      }
      for (const l of chunk.lines) {
        const trimmed = l.trim();
        if (trimmed) lines.push(trimmed);
      }

      // Now separate Name, Address, Depot, Vendor Info
      // Let's filter out vendor info at the end (e.g. "Perumal R-", "V10078", "TOI", "Deva-", "V12496")
      // and Depot (e.g. "\tRoyapuram" or "Royapuram")
      const contentLines = [];
      let vendorCode = '';
      let vendorLineName = '';

      for (const l of lines) {
        // Check for vendor code / publication
        if (/\bV\d{4,6}\b/i.test(l)) {
          const vMatch = l.match(/\bV\d{4,6}\b/i);
          if (vMatch) vendorCode = vMatch[0];
          continue;
        }
        if (/^\s*TOI\s*$/i.test(l)) {
          continue;
        }
        // Vendor line like "Perumal R-" or "Suresh B-"
        if (/^[A-Za-z\s]+-\s*$/i.test(l)) {
          vendorLineName = l.replace('-', '').trim();
          continue;
        }
        // Depot only line
        if (/^Royapuram$/i.test(l)) {
          continue;
        }

        // Clean trailing tab Royapuram or depot from the line
        let cleanL = l.replace(/\tRoyapuram.*$/i, '').replace(/Royapuram\s*$/i, '').trim();
        if (cleanL) {
          contentLines.push(cleanL);
        }
      }

      // Now separate Name from Address in contentLines
      const nameParts = [];
      const addressParts = [];
      let foundAddressStart = false;

      for (let idx = 0; idx < contentLines.length; idx++) {
        const line = contentLines[idx];
        if (!foundAddressStart) {
          if (isAddressLine(line)) {
            foundAddressStart = true;
            addressParts.push(line);
          } else {
            nameParts.push(line);
          }
        } else {
          addressParts.push(line);
        }
      }

      // Fallback: If no address was detected, maybe line 0 was name, rest is address
      if (addressParts.length === 0 && nameParts.length > 1) {
        addressParts.push(...nameParts.slice(1));
        nameParts.length = 1;
      }

      const finalName = cleanName(nameParts.join(' '));
      const finalAddress = cleanAddress(addressParts.join(', '));

      allRecords.push({
        file: chunk.file,
        vendor: chunk.vendorBase,
        sNo: chunk.sNo,
        orderId: chunk.couponNo,
        startDate: parseDate(chunk.startDate),
        expiryDate: parseDate(chunk.expiryDate),
        customerName: finalName,
        address: finalAddress,
        depot: 'Royapuram',
        vendorCode: vendorCode || undefined,
      });
    }
  }

  console.log(`\nParsed total ${allRecords.length} records across ${Object.keys(vendorSummary).length} vendors.`);
  console.log('Vendor Breakdown:', vendorSummary);

  // Check specific test cases
  const saif = allRecords.find(r => r.orderId === 'SCT55863557');
  console.log('\n--- Test Record: Mohammed Saifullah Advocate ---');
  console.log(saif);

  const noor = allRecords.find(r => r.customerName.toLowerCase().includes('noor'));
  console.log('\n--- Test Record: Noorudin ---');
  console.log(noor);

  // Check any record where name might be blank or suspiciously short
  const suspicious = allRecords.filter(r => !r.customerName || r.customerName.length < 3);
  console.log(`\nSuspicious/Short Names (${suspicious.length}):`, suspicious);

  return allRecords;
}

parseAll();
