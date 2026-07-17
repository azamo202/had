/**
 * خطوة 1: اشغل هذا الكود أولاً في Console لتعرف الأسماء الحقيقية للمشاريع في قاعدة البيانات
 */
(async () => {
  const URL = 'https://xbvalutyozrrvxfrdejn.supabase.co';
  const KEY = 'sb_publishable_yLmnusHcgptfNKfeUQ3J_A_mlvhOGeO';
  const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

  // جلب المشاريع بطرق مختلفة لنعرف اسم العمود الصحيح
  const r1 = await fetch(`${URL}/rest/v1/operational_projects?select=*&limit=3`, { headers: H });
  const projects = await r1.json();
  console.log('Projects sample:', JSON.stringify(projects, null, 2));
})();
