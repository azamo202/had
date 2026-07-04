import React from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, RadialBarChart, RadialBar,
} from 'recharts';

export const PALETTE = {
  brand: '#00A092', deep: '#007468', gold: '#CEB26B', mint: '#84D3A4', neutral: '#E3E2E2',
  completed: '#1F9D77', on_track: '#2f74d0', attention: '#E39A20', delayed: '#DB4A46', not_started: '#9AA3A0',
};
const SERIES = ['#00A092', '#CEB26B', '#84D3A4', '#007468', '#2f74d0', '#E39A20', '#DB4A46', '#7a8cff'];

const tipStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
  boxShadow: 'var(--shadow-md)', fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--text)', padding: '8px 12px',
};

function CustomTip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={tipStyle}>
      {label && <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: p.color || p.fill }} />
          <span className="t2">{p.name}:</span>
          <b>{typeof p.value === 'number' ? p.value.toLocaleString('en-US') : p.value}{unit}</b>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({ data, height = 210, inner = 58, colors = SERIES, center }) {
  return (
    <div style={{ position: 'relative', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={inner} outerRadius={inner + 26} paddingAngle={2} stroke="none">
            {data.map((d, i) => <Cell key={i} fill={d.color || colors[i % colors.length]} />)}
          </Pie>
          <Tooltip content={<CustomTip />} />
        </PieChart>
      </ResponsiveContainer>
      {center && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600 }}>{center.value}</div>
            <div className="muted" style={{ fontSize: 11 }}>{center.label}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TrendArea({ data, keys = [{ key: 'value', name: 'القيمة', color: PALETTE.brand }], height = 240, unit = '' }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
        <defs>
          {keys.map((k, i) => (
            <linearGradient key={i} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={k.color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={k.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-3)', fontFamily: 'var(--font-body)' }} axisLine={false} tickLine={false} reversed />
        <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} orientation="right" />
        <Tooltip content={<CustomTip unit={unit} />} />
        {keys.map((k, i) => (
          <Area key={i} type="monotone" dataKey={k.key} name={k.name} stroke={k.color} strokeWidth={2.4} fill={`url(#grad${i})`} dot={false} activeDot={{ r: 4 }} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarsH({ data, height = 260, color = PALETTE.brand, unit = '%' }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }} barCategoryGap={10}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11.5, fill: 'var(--text-2)', fontFamily: 'var(--font-body)' }} axisLine={false} tickLine={false} orientation="right" />
        <Tooltip content={<CustomTip unit={unit} />} cursor={{ fill: 'var(--brand-tint)' }} />
        <Bar dataKey="value" radius={[0, 7, 7, 0]} barSize={16}>
          {data.map((d, i) => <Cell key={i} fill={d.color || color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BarsV({ data, height = 240, keys = [{ key: 'value', color: PALETTE.brand, name: '' }], unit = '' }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} reversed />
        <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} orientation="right" />
        <Tooltip content={<CustomTip unit={unit} />} cursor={{ fill: 'var(--brand-tint)' }} />
        {keys.map((k, i) => <Bar key={i} dataKey={k.key} name={k.name} fill={k.color} radius={[6, 6, 0, 0]} barSize={22} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MiniSpark({ data, color = PALETTE.brand, height = 40 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 2 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function GaugeRadial({ value, color = PALETTE.brand, height = 160 }) {
  const data = [{ name: 'v', value: Math.min(100, value), fill: color }];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadialBarChart innerRadius="72%" outerRadius="100%" data={data} startAngle={220} endAngle={-40}>
        <RadialBar background={{ fill: 'var(--surface-2)' }} dataKey="value" cornerRadius={20} />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}
