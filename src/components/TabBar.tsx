import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import DisplaySettings from './DisplaySettings';

type Tab = 'stats' | 'skills' | 'combat' | 'armor' | 'features' | 'powers' | 'inventory' | 'advancement';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  hasPowers: boolean;
}

export default function TabBar({ activeTab, onTabChange, hasPowers }: Props) {
  const [showSettings, setShowSettings] = useState(false);

  const topRowKeys: Tab[] = ['stats', 'skills', 'inventory', 'combat', 'armor'];
  const bottomRowKeys: Tab[] = ['features', 'advancement'];
  if (hasPowers) bottomRowKeys.push('powers');

  const getLabel = (key: Tab) => {
    switch (key) {
      case 'stats':       return 'Stats';
      case 'skills':      return 'Skills';
      case 'combat':      return 'Weapons';
      case 'armor':       return 'Armor';
      case 'features':    return 'Features';
      case 'powers':      return 'Psykana';
      case 'inventory':   return 'Gear';
      case 'advancement': return 'Advances';
    }
  };

  const content = (
    <div className="dataslate-bezel-bottom">
      <div className="dataslate-purity-seal" />

      <div className="physical-tabs-container">
        <div className="physical-tabs-row">
          {topRowKeys.map((key) => (
            <button
              key={key}
              className={`physical-tab ${activeTab === key ? 'physical-tab--active' : ''}`}
              onClick={() => onTabChange(key)}
              id={`tab-${key}`}
            >
              {getLabel(key)}
            </button>
          ))}
        </div>
        <div className="physical-tabs-row">
          {bottomRowKeys.map((key) => (
            <button
              key={key}
              className={`physical-tab ${activeTab === key ? 'physical-tab--active' : ''}`}
              onClick={() => onTabChange(key)}
              id={`tab-${key}`}
            >
              {getLabel(key)}
            </button>
          ))}
        </div>
      </div>

      {/* Dial — Mechanicus cog embossed, opens Display Settings */}
      <button
        className="dataslate-trackball"
        onClick={() => setShowSettings(true)}
        title="Display Settings"
      />
    </div>
  );

  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setContainer(document.getElementById('bottom-bezel-container'));
  }, []);

  if (!container) return null;

  return (
    <>
      {createPortal(content, container)}
      {showSettings && <DisplaySettings onClose={() => setShowSettings(false)} />}
    </>
  );
}
