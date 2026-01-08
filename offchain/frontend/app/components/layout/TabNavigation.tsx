import { LayoutDashboard, Cpu, Link, Activity } from 'lucide-react';

export type TabId = 'dashboard' | 'sensors' | 'transactions' | 'measurements';

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs = [
  { id: 'dashboard' as TabId, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'sensors' as TabId, label: 'Sensores', icon: Cpu },
  { id: 'transactions' as TabId, label: 'Blockchain', icon: Link },
  { id: 'measurements' as TabId, label: 'Mediciones', icon: Activity },
];

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <nav className="border-b border-zinc-700 bg-zinc-800/30">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 border-b-2 transition-colors
                  ${isActive
                    ? 'border-blue-400 text-blue-400 bg-zinc-800'
                    : 'border-transparent text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
