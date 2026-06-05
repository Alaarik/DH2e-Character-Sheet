import { useState, useEffect, useRef } from 'react';
import { applyDisplayPrefs, loadDisplayPrefs } from './components/DisplaySettings';
import { useAuth } from './hooks/useAuth';
import { useToast } from './hooks/useToast';
import Login from './pages/Login';
import CharacterList from './pages/CharacterList';
import CharacterSheet from './pages/CharacterSheet';
import NotesPage from './pages/NotesPage';
import DiceRoller from './components/DiceRoller';
import CharacterJournalPicker from './components/CharacterJournalPicker';
import ToastContainer from './components/ToastContainer';

type View =
  | { page: 'list' }
  | { page: 'sheet'; characterId: number; characterName: string }
  | { page: 'notes'; characterId: number; characterName: string };

export default function App() {
  const { user, loading, login } = useAuth();
  const toast = useToast();
  const [view, setView]             = useState<View>({ page: 'list' });
  const [offline, setOffline]       = useState(!navigator.onLine);
  const [showDice, setShowDice]     = useState(false);
  const [showJournalPicker, setShowJournalPicker] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const addCharTrigger = useRef<(() => void) | null>(null);
  const pendingAdd     = useRef(false);

  // Button I — Add New Character from any page
  const handleAddCharBtn = () => {
    if (view.page === 'list') {
      addCharTrigger.current?.();
    } else {
      pendingAdd.current = true;
      setView({ page: 'list' });
    }
  };

  // Apply stored display settings on first mount
  useEffect(() => { applyDisplayPrefs(loadDisplayPrefs()); }, []);

  // Offline detection
  useEffect(() => {
    const goOffline = () => { setOffline(true);  toast.info('You are offline — changes won\'t save.'); };
    const goOnline  = () => { setOffline(false); toast.success('Back online!'); };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online',  goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online',  goOnline);
    };
  }, [toast]);

  // Button III — Journal: go directly when on sheet/notes, otherwise picker
  const handleJournalBtn = () => {
    if (view.page === 'sheet' || view.page === 'notes') {
      setView({ page: 'notes', characterId: view.characterId, characterName: view.characterName });
    } else {
      setShowJournalPicker(true);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={login} />;
  }

  // ── Button state helpers ─────────────────────────────────────────────────────────
  const btnII_active  = showDice;
  const btnIII_active = view.page === 'notes';
  const btnIV_active  = view.page !== 'list';

  // ── Label visibility ──
  // Hide all labels when Character Creator is open
  const btnI_labelClass = 'dataslate-left-btn-row--label-on'; // Always show label for btnI
  const btnII_labelClass = btnII_active ? 'dataslate-left-btn-row--label-on' : '';
  const btnIII_labelClass = btnIII_active ? 'dataslate-left-btn-row--label-on' : '';
  const btnIV_labelClass  = btnIV_active ? 'dataslate-left-btn-row--label-on' : '';

  return (
    <div className="dataslate-wrapper">
      <div className="dataslate-chassis">

        {/* Left Bezel */}
        <div className="dataslate-bezel-left">
          <div className="dataslate-purity-seal" style={{ position: 'absolute', top: '15px', left: '8px', zIndex: 1050, margin: 0 }} />

          {/* Aquila + label — top */}
          <div className="dataslate-bezel-left-label">
            <div className="dataslate-aquila-isolate">
              <div className="dataslate-bezel-aquila-wrapper">
                <img src="/crt-aquila.png" className="dataslate-bezel-aquila-img" alt="" />
              </div>
            </div>
            <span className="dataslate-bezel-text">IMPERIUM DATA SLATE Model 75.RT&#8209;E1.41K</span>
          </div>

          {/* Buttons */}
          <div className="dataslate-left-buttons">

            {/* I — Add New Character: always active, navigates to list + opens dialog */}
            <div className={`dataslate-left-btn-row ${btnI_labelClass}`}>
              <div
                className="dataslate-left-btn dataslate-left-btn--interactive dataslate-left-btn--active"
                onClick={handleAddCharBtn}
                title="Add New Character"
              >
                I
              </div>
              <div className="dataslate-btn-label">
                <div className="dataslate-btn-label__line" />
                <span className="dataslate-btn-label__text">Add New Character</span>
              </div>
            </div>

            {/* II — Dice Roller: label persists while overlay is open */}
            <div className={`dataslate-left-btn-row ${btnII_labelClass}`}>
              <div
                className={`dataslate-left-btn dataslate-left-btn--interactive${btnII_active ? ' dataslate-left-btn--active' : ''}`}
                onClick={() => setShowDice(d => !d)}
                title="Dice Roller"
              >
                II
              </div>
              <div className="dataslate-btn-label">
                <div className="dataslate-btn-label__line" />
                <span className="dataslate-btn-label__text">Dice</span>
              </div>
            </div>

            {/* III — Journal: label persists when on notes page */}
            <div className={`dataslate-left-btn-row ${btnIII_labelClass}`}>
              <div
                className={`dataslate-left-btn dataslate-left-btn--interactive${btnIII_active ? ' dataslate-left-btn--active' : ''}`}
                onClick={handleJournalBtn}
                title="Journal"
              >
                III
              </div>
              <div className="dataslate-btn-label">
                <div className="dataslate-btn-label__line" />
                <span className="dataslate-btn-label__text">Journal</span>
              </div>
            </div>

            {/* IV — Home: label persists when away from list */}
            <div className={`dataslate-left-btn-row ${btnIV_labelClass}`}>
              <div
                className={`dataslate-left-btn dataslate-left-btn--interactive${btnIV_active ? ' dataslate-left-btn--active' : ''}`}
                onClick={() => setView({ page: 'list' })}
                title="Home"
              >
                IV
              </div>
              <div className="dataslate-btn-label">
                <div className="dataslate-btn-label__line" />
                <span className="dataslate-btn-label__text">Home</span>
              </div>
            </div>

          </div>
        </div>


        {/* Center Column */}
        <div className="dataslate-center-column">
          <div className="dataslate-center">
            <div className="crt-inquisition-watermark" />
            <div className="crt-aquila-watermark" />
            <div className="dataslate-screen-container">
              {offline && <div className="offline-bar">⚡ You are offline</div>}
              <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />

              {view.page === 'sheet' ? (
                <CharacterSheet
                  characterId={view.characterId}
                  onBack={() => setView({ page: 'list' })}
                  toast={toast}
                />
              ) : view.page === 'notes' ? (
                <NotesPage
                  characterId={view.characterId}
                  characterName={view.characterName}
                />
              ) : (
                <CharacterList
                  onSelectCharacter={(id, name) => setView({ page: 'sheet', characterId: id, characterName: name })}
                  toast={toast}
                  onAddCharacter={(trigger) => {
                    addCharTrigger.current = trigger;
                    if (pendingAdd.current) {
                      pendingAdd.current = false;
                      trigger();
                    }
                  }}
                  onCreatingChange={setIsCreating}
                />
              )}
            </div>
          </div>

          {/* Bottom Bezel Portal Target */}
          <div id="bottom-bezel-container" />
        </div>

        {/* Right Bezel */}
        <div className="dataslate-bezel-right">
          <div className="dataslate-bezel-right-greeble" />
          <div className="dataslate-bezel-right-greeble" />
        </div>

      </div>

      {/* Overlays — rendered outside chassis so they cover everything */}
      {showDice && <DiceRoller onClose={() => setShowDice(false)} />}
      {showJournalPicker && (
        <CharacterJournalPicker
          onSelect={(id, name) => {
            setShowJournalPicker(false);
            setView({ page: 'notes', characterId: id, characterName: name });
          }}
          onClose={() => setShowJournalPicker(false)}
        />
      )}
    </div>
  );
}
