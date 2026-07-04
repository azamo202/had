import React from 'react';
import { PageHead } from '../components/ui/Bits.jsx';
import ImportExcel from '../components/ImportExcel.jsx';
import { useApp } from '../store/AppContext.jsx';
import { can } from '../lib/status.js';
import { Shield } from 'lucide-react';

export default function DataImport() {
  const { user } = useApp();
  const admin = can.admin(user?.role);

  if (!admin) {
    return (
      <div className="page fade-in">
        <PageHead title="استيراد البيانات" />
        <div className="card pad">
          <div className="row" style={{ gap: 10, color: 'var(--text-2)' }}>
            <Shield size={17} />
            <span style={{ fontSize: 13.5 }}>هذه الصفحة متاحة لمكتب الاستراتيجية فقط.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page fade-in">
      <PageHead title="استيراد الخطة الإستراتيجية والتشغيلية" sub="رفع ملف الإكسل (Excel) لتحديث أو إنشاء قاعدة البيانات" />
      <ImportExcel />
    </div>
  );
}
