import { Lock } from 'lucide-react';

export default function PhasePlaceholder({ module }) {
  return (
    <div className="ba-phase-placeholder">
      <Lock size={28} />
      <h2>{module.label}</h2>
      <p>{module.description}</p>
      <p className="ba-phase-placeholder__badge">Opens in Phase {module.phase}</p>
      <ul>
        <li>Event table <code>analytics_events</code> is provisioned.</li>
        <li>Use <code>trackAnalyticsEvent()</code> from product surfaces in Phase 2.</li>
        <li>This page will light up automatically once events are flowing — no IA redesign.</li>
      </ul>
    </div>
  );
}
