const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const vendorDir = 'd:/TOI_Admin_Data/TOI Vendor Details';

function cleanName(raw) {
  if (!raw) return '';
  let cleaned = raw
    .replace(/[,\t]+/g, ' ')
    .replace(/\.+/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
  cleaned = cleaned.replace(/\s*\.+\s*$/, '');
  return cleaned;
}

function cleanAddress(raw) {
  if (!raw) return '';
  return raw
    .replace(/,{2,}/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/\s*,\s*/g, ', ')
    .replace(/,\s*Royapuram/i, ', Royapuram')
    .trim()
    .replace(/,\s*$/, '');
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.trim().match(/^(\d{2})[.\/\-](\d{2})[.\/\-](\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return dateStr;
}

function isAddressLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;

  if (/,{2,}/.test(trimmed)) return true;
  if (/\b600\d{3}\b/.test(trimmed)) return true;
  if (/^(no[\.\s]|plot|flat|door|old\s*no|new\s*no|shop|d\.?no)/i.test(trimmed)) {
    if (/^noor/i.test(trimmed)) return false;
    return true;
  }
  if (/^\d+[\/\-A-Za-z0-9]*,?/.test(trimmed)) {
    return true;
  }
  if (/\b(street|road|st|rd|lane|nagar|colony|arcade|floor|washerm|royapuram|tondiarpet)\b/i.test(trimmed)) {
    return true;
  }

  return false;
}

async function run() {
  const files = fs.readdirSync(vendorDir).filter(f => f.endsWith('.pdf'));
  console.log(`Found ${files.length} vendor PDF files.`);

  // Define vendors with stable IDs and codes
  const vendorMeta = [
    { id: 'vendor-1', name: 'Arumugam', vendor_name: 'Arumugam', code: 'V10012 TOI', mobile: '+91 98401 23451' },
    { id: 'vendor-2', name: 'Deva', vendor_name: 'Deva', code: 'V12496 TOI', mobile: '+91 98402 34562' },
    { id: 'vendor-3', name: 'Dilli', vendor_name: 'Dilli', code: 'V12663 TOI', mobile: '+91 98403 45673' },
    { id: 'vendor-4', name: 'Ganesan', vendor_name: 'Ganesan', code: 'V10034 TOI', mobile: '+91 98404 56784' },
    { id: 'vendor-5', name: 'Jeeva', vendor_name: 'Jeeva', code: 'V12494 TOI', mobile: '+91 98405 67895' },
    { id: 'vendor-6', name: 'Kaliappan', vendor_name: 'Kaliappan', code: 'V12677 TOI', mobile: '+91 98406 78906' },
    { id: 'vendor-7', name: 'Kumaravel', vendor_name: 'Kumaravel', code: 'V10056 TOI', mobile: '+91 98407 89017' },
    { id: 'vendor-8', name: 'Meeran bai and Mohideen', vendor_name: 'Meeran bai and Mohideen', code: 'V10089 TOI', mobile: '+91 98408 90128' },
    { id: 'vendor-9', name: 'Murugesan', vendor_name: 'Murugesan', code: 'V10045 TOI', mobile: '+91 98409 01239' },
    { id: 'vendor-10', name: 'Navaneetham', vendor_name: 'Navaneetham', code: 'V12688 TOI', mobile: '+91 98410 12340' },
    { id: 'vendor-11', name: 'Perumal', vendor_name: 'Perumal', code: 'V10078 TOI', mobile: '+91 98411 23451' },
    { id: 'vendor-12', name: 'Rajaendiren', vendor_name: 'Rajaendiren', code: 'V10023 TOI', mobile: '+91 98412 34562' },
    { id: 'vendor-13', name: 'Srinivasan', vendor_name: 'Srinivasan', code: 'V10067 TOI', mobile: '+91 98413 45673' },
    { id: 'vendor-14', name: 'Suresh', vendor_name: 'Suresh', code: 'V12663 TOI', mobile: '+91 98414 56784' },
  ];

  const vendorMap = {};
  vendorMeta.forEach(v => {
    vendorMap[v.name.toLowerCase()] = v;
  });

  const parsedCustomers = [];
  let globalCustIdx = 1;

  for (const file of files) {
    const rawVendorName = file.replace(/\.pdf$/i, '').trim();
    const vendorObj = vendorMap[rawVendorName.toLowerCase()] || {
      id: `vendor-${rawVendorName}`,
      name: rawVendorName,
      code: 'TOI',
      mobile: '+91 98400 00000',
    };

    const filePath = path.join(vendorDir, file);
    const buf = fs.readFileSync(filePath);
    const parser = new PDFParse(new Uint8Array(buf));
    const parsed = await parser.getText();

    let fullText = '';
    for (const page of parsed.pages) {
      fullText += page.text + '\n';
    }

    const rawLines = fullText.split('\n');
    const recordHeaderRegex = /^\s*(\d+)\s+([A-Z0-9]+)\s+(\d{2}[.\/\-]\d{2}[.\/\-]\d{4})\s+(\d{2}[.\/\-]\d{2}[.\/\-]\d{4})(.*)$/;

    const chunks = [];
    let currentChunk = null;

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const match = line.match(recordHeaderRegex);

      if (match) {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = {
          sNo: match[1],
          couponNo: match[2],
          startDate: match[3],
          expiryDate: match[4],
          remainder: match[5] ? match[5].trim() : '',
          lines: [],
        };
      } else if (currentChunk) {
        if (line.includes('S.No') && line.includes('Coupon No')) {
          // header line, ignore
        } else {
          currentChunk.lines.push(line);
        }
      }
    }
    if (currentChunk) chunks.push(currentChunk);

    for (const chunk of chunks) {
      const lines = [];
      if (chunk.remainder) lines.push(chunk.remainder);
      for (const l of chunk.lines) {
        const trimmed = l.trim();
        if (trimmed) lines.push(trimmed);
      }

      const contentLines = [];
      for (const l of lines) {
        if (/\bV\d{4,6}\b/i.test(l)) continue;
        if (/^\s*TOI\s*$/i.test(l)) continue;
        if (/^[A-Za-z\s]+-\s*$/i.test(l)) continue;
        if (/^Royapuram$/i.test(l)) continue;

        let cleanL = l.replace(/\tRoyapuram.*$/i, '').replace(/Royapuram\s*$/i, '').trim();
        if (cleanL) contentLines.push(cleanL);
      }

      const nameParts = [];
      const addressParts = [];
      let foundAddressStart = false;

      for (const line of contentLines) {
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

      if (addressParts.length === 0 && nameParts.length > 1) {
        addressParts.push(...nameParts.slice(1));
        nameParts.length = 1;
      }

      const finalName = cleanName(nameParts.join(' '));
      const finalAddress = cleanAddress(addressParts.join(', '));
      const custId = `cust-${globalCustIdx}`;
      const subId = `sub-${globalCustIdx}`;

      parsedCustomers.push({
        id: custId,
        customer_id: custId,
        order_id: chunk.couponNo,
        customer_name: finalName,
        address: finalAddress,
        depot: 'Royapuram',
        mobile_number: null,
        notes: '',
        vendor_id: vendorObj.id,
        vendor_name: vendorObj.name,
        vendor_code: vendorObj.code,
        publication: 'TOI',
        subscriptions: [
          {
            id: subId,
            customer_id: custId,
            start_date: parseDate(chunk.startDate),
            end_date: parseDate(chunk.expiryDate),
            status: 'active',
            is_current: true,
          }
        ]
      });

      globalCustIdx++;
    }
  }

  console.log(`Generated ${parsedCustomers.length} customers.`);

  // Verify specific cases
  const saif = parsedCustomers.find(c => c.order_id === 'SCT55863557');
  console.log('Verification - Mohammed Saifullah Advocate:');
  console.log(saif);

  // Write to src/data/seedData.json
  const seedOutput = {
    updatedAt: new Date().toISOString(),
    vendors: vendorMeta,
    customers: parsedCustomers,
  };

  fs.writeFileSync(
    path.join(__dirname, '../src/data/seedData.json'),
    JSON.stringify(seedOutput, null, 2),
    'utf8'
  );

  console.log('Successfully written to src/data/seedData.json!');
}

run();
