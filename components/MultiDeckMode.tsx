'use client';

import { useState, useCallback } from 'react';
import DeckMode from './DeckMode';

interface Tab {
  id: string;
  name: string;
}

let tabCounter = 0;
const generateTabId = () => `deck-${Date.now()}-${++tabCounter}`;

export default function MultiDeckMode() {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: generateTabId(), name: 'デッキ1' }
  ]);
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);

  // タブ追加
  const addTab = useCallback(() => {
    const newTab: Tab = {
      id: generateTabId(),
      name: `デッキ${tabs.length + 1}`,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [tabs.length]);

  // タブ削除
  const removeTab = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) return;
    
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(newTabs[0].id);
      }
      return newTabs;
    });
  }, [tabs.length, activeTabId]);

  // タブ名変更
  const renameTab = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    const newName = prompt('デッキ名を入力', tab.name);
    if (newName && newName.trim()) {
      setTabs(prev => prev.map(t => 
        t.id === tabId ? { ...t, name: newName.trim() } : t
      ));
    }
  }, [tabs]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* タブバー */}
      <div className="bg-gray-100 border-b px-2 py-1 flex items-center gap-1 overflow-x-auto flex-shrink-0">
        {tabs.map(tab => (
          <div
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            onDoubleClick={() => renameTab(tab.id)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-t cursor-pointer
              transition-colors select-none min-w-[100px] max-w-[200px]
              ${activeTabId === tab.id
                ? 'bg-white border-t border-l border-r border-gray-300 -mb-px'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
              }
            `}
          >
            <span className="truncate flex-1 text-sm font-medium">
              {tab.name}
            </span>
            {tabs.length > 1 && (
              <button
                onClick={(e) => removeTab(tab.id, e)}
                className="text-gray-400 hover:text-red-500 text-lg leading-none"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addTab}
          className="px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded text-lg"
          title="新しいデッキを追加"
        >
          ＋
        </button>
        
        {/* 操作ヒント */}
        <div className="ml-auto text-xs text-gray-400 hidden sm:block">
          ダブルクリックで名前変更
        </div>
      </div>

      {/* タブコンテンツ（各DeckModeを表示/非表示で切り替え） */}
      <div className="flex-1 relative">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={activeTabId === tab.id ? 'block' : 'hidden'}
          >
            <DeckMode />
          </div>
        ))}
      </div>
    </div>
  );
}
