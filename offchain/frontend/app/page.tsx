'use client';

import { useState } from 'react';
import { Header } from './components/layout/Header';
import { TabNavigation, type TabId } from './components/layout/TabNavigation';
import { DashboardView } from './components/dashboard/DashboardView';
import { SensorListView } from './components/sensors/SensorListView';
import { TransactionHistoryView } from './components/transactions/TransactionHistoryView';
import { MeasurementTimelineView } from './components/measurements/MeasurementTimelineView';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  return (
    <div className="min-h-screen bg-zinc-900">
      <Header />
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'sensors' && <SensorListView />}
        {activeTab === 'transactions' && <TransactionHistoryView />}
        {activeTab === 'measurements' && <MeasurementTimelineView />}
      </main>
    </div>
  );
}
