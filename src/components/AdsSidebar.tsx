import { NavLink } from 'react-router-dom';
import { BarChart3, Megaphone, Sparkles, Bell, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';

const navItems = [
  { to: '/ads/overview', icon: BarChart3, label: 'Áttekintés' },
  { to: '/ads/campaigns', icon: Megaphone, label: 'Kampányok' },
  { to: '/ads/ai', icon: Sparkles, label: 'AI Elemzés' },
  { to: '/ads/alerts', icon: Bell, label: 'Riasztások' },
  { to: '/ads/settings', icon: Settings, label: 'Beállítások' },
];

export default function AdsSidebar() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('ads-sidebar-collapsed') === 'true');
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    loadAlertCount();
    const unsub = window.electronAPI.onAdsAlertsUpdated(({ alertCount }) => {
      setAlertCount(alertCount);
    });
    return unsub;
  }, []);

  async function loadAlertCount() {
    try {
      const res = await window.electronAPI.adsGetAlertCount();
      if (res.success && res.data) setAlertCount(res.data.count);
    } catch { /* ignore */ }
  }

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('ads-sidebar-collapsed', String(next));
      return next;
    });
  }

  return (
    <aside
      className={`${collapsed ? 'w-14' : 'w-52'} bg-surface-950 border-r border-teal/10 flex flex-col shrink-0 transition-[width] duration-200 ease-in-out`}
    >
      {/* Brand */}
      <div className={`${collapsed ? 'px-2' : 'px-3'} pt-4 pb-3`}>
        {!collapsed && (
          <p className="font-pixel text-[11px] text-teal tracking-wider px-3 mb-1">KLIENT ADS</p>
        )}
      </div>

      <div className={`h-px bg-teal/10 ${collapsed ? 'mx-2' : 'mx-3'}`} />

      {/* Navigation */}
      <nav className={`flex-1 py-4 ${collapsed ? 'px-2' : 'px-3'} space-y-0.5`}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'} rounded-md text-[13px] transition-all relative ${
                isActive
                  ? 'bg-teal/15 text-cream font-semibold before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:rounded-full before:bg-steel'
                  : 'text-steel font-medium hover:bg-teal/8 hover:text-ash'
              }`
            }
          >
            <item.icon width={16} height={16} />
            {!collapsed && <span>{item.label}</span>}
            {item.to === '/ads/alerts' && alertCount > 0 && (
              <span className={`${collapsed ? 'absolute -top-0.5 -right-0.5' : 'ml-auto'} w-2 h-2 rounded-full bg-red-500`} />
            )}
          </NavLink>
        ))}
      </nav>

      <div className={`${collapsed ? 'px-2' : 'px-3'} py-3 border-t border-teal/10 space-y-2`}>
        {/* Collapse toggle */}
        <button
          onClick={toggleCollapsed}
          className="w-full flex items-center justify-center py-1.5 rounded-md text-steel/50 hover:text-steel hover:bg-teal/8 transition-colors"
          title={collapsed ? 'Sidebar kinyitása' : 'Sidebar összezárása'}
        >
          {collapsed
            ? <span className="text-xs">→</span>
            : <span className="text-xs">←</span>
          }
        </button>
      </div>
    </aside>
  );
}
