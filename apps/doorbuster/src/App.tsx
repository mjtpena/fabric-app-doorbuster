import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '@x10/shared/runtime';

import { AboutPage } from './pages/AboutPage';
import { ArcadePage } from './pages/ArcadePage';
import { CalendarPage } from './pages/CalendarPage';
import { ReceiptsPage } from './pages/ReceiptsPage';
import { ShopfrontPage } from './pages/ShopfrontPage';
import { StaffPage } from './pages/StaffPage';
import { TickerPage } from './pages/TickerPage';
import { VelvetRopePage } from './pages/VelvetRopePage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell immersive><ArcadePage /></AppShell>} />
      <Route path="/shopfront" element={<AppShell><ShopfrontPage /></AppShell>} />
      <Route path="/shopfront/:id" element={<AppShell><ShopfrontPage /></AppShell>} />
      <Route path="/rope" element={<AppShell><VelvetRopePage /></AppShell>} />
      <Route path="/rope/:id" element={<AppShell><VelvetRopePage /></AppShell>} />
      <Route path="/ticker" element={<AppShell wide><TickerPage /></AppShell>} />
      <Route path="/ticker/:id" element={<AppShell wide><TickerPage /></AppShell>} />
      <Route path="/calendar" element={<AppShell wide><CalendarPage /></AppShell>} />
      <Route path="/receipts" element={<AppShell><ReceiptsPage /></AppShell>} />
      <Route path="/staff" element={<AppShell><StaffPage /></AppShell>} />
      <Route path="/about" element={<AppShell><AboutPage /></AppShell>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
