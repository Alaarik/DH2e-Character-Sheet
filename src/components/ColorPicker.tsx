const PRESET_COLORS = [
  '#8b5cf6', // Purple (default)
  '#ef4444', // Red
  '#f59e0b', // Amber
  '#22c55e', // Green
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#f97316', // Orange
  '#a855f7', // Violet
  '#14b8a6', // Teal
  '#6366f1', // Indigo
  '#e11d48', // Rose
];

interface Props {
  currentColor: string;
  onChange: (color: string) => void;
}

export default function ColorPicker({ currentColor, onChange }: Props) {
  return (
    <div className="color-picker">
      {PRESET_COLORS.map(color => (
        <button
          key={color}
          className={`color-picker__swatch ${currentColor === color ? 'color-picker__swatch--active' : ''}`}
          style={{ backgroundColor: color, color }}
          onClick={() => onChange(color)}
          title={color}
        />
      ))}
      <div className="color-picker__custom" title="Custom color">
        <input
          type="color"
          value={currentColor}
          onChange={e => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
