import xlsx from 'xlsx';

const workbook = xlsx.readFile('test.xlsx');
for (const sheetName of workbook.SheetNames) {
  console.log('--- Sheet:', sheetName);
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  console.log('Headers:', data[0]);
  console.log('Row 1:', data[1]);
}
