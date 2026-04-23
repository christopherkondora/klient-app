import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useAds } from '../contexts/AdsContext';

export default function AdsAccountSelector() {
  const { accounts, selectedAccount, selectAccount } = useAds();
  const [open, setOpen] = useState(false);
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.electronAPI.getClients().then(clients => {
      const map: Record<string, string> = {};
      clients.forEach((client: Client) => {
        map[client.id] = client.name;
      });
      setClientNames(map);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (buttonRef.current?.contains(event.target as Node)) return;
      if (dropdownRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  if (accounts.length <= 1 || !selectedAccount) {
    return null;
  }

  const getDisplayName = (account: AdsAccountRow) => {
    if (account.client_id && clientNames[account.client_id]) {
      return clientNames[account.client_id];
    }
    return account.name;
  };

  const rect = buttonRef.current?.getBoundingClientRect();

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-2 px-3.5 py-2 bg-[#0C2230] border border-teal/15 rounded-lg hover:border-teal/25 transition-colors"
      >
        <div className="text-left">
          <p className="text-sm text-cream font-medium leading-tight">
            {getDisplayName(selectedAccount)}
          </p>
          <p className="text-[10px] text-steel/40">{selectedAccount.customer_id}</p>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-steel/50 shrink-0" />
      </button>

      {open && rect && createPortal(
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={() => setOpen(false)}
          />
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: rect.bottom + 4,
              left: rect.left,
              minWidth: Math.max(rect.width, 240),
              zIndex: 9999,
            }}
            className="bg-[#0C2230] border border-teal/15 rounded-lg shadow-2xl py-1"
          >
            {accounts.map(account => {
              const displayName = getDisplayName(account);
              return (
                <button
                  key={account.id}
                  onClick={() => {
                    selectAccount(account);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 hover:bg-teal/10 transition-colors ${account.id === selectedAccount.id ? 'bg-teal/5' : ''}`}
                >
                  <p className={`text-xs font-medium ${account.id === selectedAccount.id ? 'text-teal' : 'text-cream/80'}`}>
                    {displayName}
                  </p>
                  <p className="text-[10px] text-steel/40">{account.customer_id}</p>
                </button>
              );
            })}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}