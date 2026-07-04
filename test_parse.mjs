import xlsx from 'xlsx';

const workbook = xlsx.readFile('test.xlsx');

let totalProjects = 0;
let totalInit = 0;

for (const sheetName of workbook.SheetNames) {
  if (!sheetName.startsWith('الهدف')) continue;
  
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  if (rows.length < 2) continue;
  
  const headers = rows[0];
  let goalIdx = -1;
  let objIdx = -1;
  let initIdx = -1;
  let deptIdx = -1;
  let projIdx = -1;
  let costIdx = -1;

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]?.toString().trim();
    if (!h) continue;
    if (h.includes('الهدف الاستراتيجي')) goalIdx = i;
    else if (h.includes('الهدف الفرعي')) objIdx = i;
    else if (h.includes('المبادرة الاستراتيجية')) initIdx = i;
    else if (h.includes('الإدارة') || h.includes('القطاع')) deptIdx = i;
    else if (h.includes('المشاريع التشغيلية')) projIdx = i;
    else if (h.includes('تكلفة التنفيذ') || h.includes('ميزانية')) costIdx = i;
  }
  
  console.log(`\nSheet: ${sheetName}`);
  console.log(`Headers Row 0 (Top):`);
  headers.forEach((h, i) => h && console.log(`[${i}] ${h.toString().trim()}`));
  console.log(`Headers Row 1 (Sub):`);
  const subHeaders = rows[1] || [];
  subHeaders.forEach((h, i) => h && console.log(`[${i}] ${h.toString().trim()}`));
  console.log(`Indexes - Goal:${goalIdx}, Obj:${objIdx}, Init:${initIdx}, Dept:${deptIdx}, Proj:${projIdx}, Cost:${costIdx}`);

  let lastGoal = null, lastObj = null, lastInit = null, lastDept = null;
  let sheetProjects = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (goalIdx >= 0 && row[goalIdx]) lastGoal = row[goalIdx]?.toString().trim();
    if (objIdx >= 0 && row[objIdx]) lastObj = row[objIdx]?.toString().trim();
    if (initIdx >= 0 && row[initIdx]) lastInit = row[initIdx]?.toString().trim();
    if (deptIdx >= 0 && row[deptIdx]) lastDept = row[deptIdx]?.toString().trim();

    const goal = lastGoal;
    const init = lastInit;
    const proj = row[projIdx]?.toString().trim();
    
    if (init) totalInit++;
    if (proj && init) {
      sheetProjects++;
      totalProjects++;
    }
  }
  console.log(`  Found ${sheetProjects} projects in this sheet.`);
}

console.log(`Total initiatives: ${totalInit}`);
console.log(`Total projects: ${totalProjects}`);
