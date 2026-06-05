import { useState, useEffect, useRef, useCallback } from 'react';

interface Props {
  characterId: number;
  characterName: string;
}

const storageKey = (id: number) => `journal-char-${id}`;

export default function NotesPage({ characterId, characterName }: Props) {
  const [text, setText]   = useState('');
  const [saved, setSaved] = useState(true);
  const timerRef = useRef<number | null>(null);

  // Load from localStorage when character changes
  useEffect(() => {
    const stored = localStorage.getItem(storageKey(characterId));
    setText(stored ?? '');
    setSaved(true);
  }, [characterId]);

  const handleChange = useCallback((val: string) => {
    setText(val);
    setSaved(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      localStorage.setItem(storageKey(characterId), val);
      setSaved(true);
    }, 800);
  }, [characterId]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div className="notes-page">
      <div className="notes-page__scanlines" />

      <div className="notes-page__header">
        <div className="notes-page__title-group">
          <span className="notes-page__kicker">COGITATOR MEMO · FIELD RECORD</span>
          <h1 className="notes-page__character">{characterName}</h1>
        </div>
        <span className={`notes-page__status notes-page__status--${saved ? 'saved' : 'saving'}`}>
          {saved ? '● STORED' : '○ WRITING…'}
        </span>
      </div>

      <div className="notes-page__rule" />

      <textarea
        className="notes-page__textarea"
        value={text}
        onChange={e => handleChange(e.target.value)}
        placeholder="BEGIN RECORD…"
        spellCheck={false}
        autoFocus
      />

      <div className="notes-page__footer">
        <span>INQUISITION DATASLATE · CLASSIFIED · REF&nbsp;{characterId.toString().padStart(4, '0')}</span>
      </div>
    </div>
  );
}
