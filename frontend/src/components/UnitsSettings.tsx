import { UNITS, type UnitCategory, type UnitSettings } from '../data/unitsDatabase';

const CATEGORIES: { key: UnitCategory; label: string }[] = [
    { key: 'molarFlow',   label: 'Molar Flow' },
    { key: 'massFlow',    label: 'Mass Flow' },
    { key: 'temperature', label: 'Temperature' },
    { key: 'pressure',    label: 'Pressure' },
    { key: 'energy',      label: 'Energy/Power' },
    { key: 'time',        label: 'Time' },
];

export default function UnitSettings({ settings, onChange }: {
    settings: UnitSettings;
    onChange: (s: UnitSettings) => void;
}) {
    const selectStyle = {
        background: '#0f172a', border: '1px solid #334155', borderRadius: 4,
        color: '#e2e8f0', fontSize: 11, padding: '3px 6px', width: '100%',
        cursor: 'pointer'
    };

    return (
        <div style={{ padding: '8px 12px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: 1, marginBottom: 8 }}>UNITS SETTINGS</div>
            {CATEGORIES.map(({ key, label }) => (
                <div key={key} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: '#475569', marginBottom: 2 }}>{label}</div>
                    <select
                        style={selectStyle}
                        value={settings[key]}
                        onChange={e => onChange({ ...settings, [key]: e.target.value })}>
                        {UNITS[key].map(u => (
                            <option key={u.label} value={u.label}>{u.label}</option>
                        ))}
                    </select>
                </div>
            ))}
        </div>
    );
}