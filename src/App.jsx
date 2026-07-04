import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import StrategicFramework from './pages/StrategicFramework.jsx';
import StrategicPlan from './pages/StrategicPlan.jsx';
import OperationalPlan from './pages/OperationalPlan.jsx';
import Objectives from './pages/Objectives.jsx';
import Initiatives from './pages/Initiatives.jsx';
import Projects from './pages/Projects.jsx';
import KPIs from './pages/KPIs.jsx';
import MonthlyFollowup from './pages/MonthlyFollowup.jsx';
import Challenges from './pages/Challenges.jsx';
import Evidence from './pages/Evidence.jsx';
import Reports from './pages/Reports.jsx';
import AIAssistant from './pages/AIAssistant.jsx';
import Notifications from './pages/Notifications.jsx';
import UsersPage from './pages/Users.jsx';
import Settings from './pages/Settings.jsx';
import DataImport from './pages/DataImport.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/framework" element={<StrategicFramework />} />
        <Route path="/strategic" element={<StrategicPlan />} />
        <Route path="/operational" element={<OperationalPlan />} />
        <Route path="/objectives" element={<Objectives />} />
        <Route path="/initiatives" element={<Initiatives />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/kpis" element={<KPIs />} />
        <Route path="/followup" element={<MonthlyFollowup />} />
        <Route path="/challenges" element={<Challenges />} />
        <Route path="/evidence" element={<Evidence />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/assistant" element={<AIAssistant />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/import" element={<DataImport />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
