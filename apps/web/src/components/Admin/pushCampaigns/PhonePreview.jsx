import { useState } from 'react';

/**
 * Lightweight Android / iOS notification preview frames for admin designer.
 */
export default function PhonePreview({ title, body, imageUrl }) {
  const [platform, setPlatform] = useState('android');

  return (
    <div className="push-phone-preview">
      <div className="push-phone-preview__tabs">
        <button
          type="button"
          className={platform === 'android' ? 'active' : ''}
          onClick={() => setPlatform('android')}
        >
          Android
        </button>
        <button
          type="button"
          className={platform === 'ios' ? 'active' : ''}
          onClick={() => setPlatform('ios')}
        >
          iOS
        </button>
      </div>

      <div className={`push-phone-frame push-phone-frame--${platform}`}>
        <div className="push-phone-frame__bezel">
          <div className="push-phone-frame__notch" />
          <div className="push-phone-frame__screen">
            <div className="push-phone-frame__status">
              <span>9:41</span>
              <span>{platform === 'ios' ? '●●● Wi‑Fi' : 'LTE █'}</span>
            </div>
            <div className={`push-notif push-notif--${platform}`}>
              <div className="push-notif__app">
                <span className="push-notif__badge">F</span>
                <span>Finbrella</span>
                <span className="push-notif__time">now</span>
              </div>
              <div className="push-notif__title">{title?.trim() || 'Notification title'}</div>
              <div className="push-notif__body">
                {body?.trim() || 'Notification body preview appears here.'}
              </div>
              {imageUrl?.trim() ? (
                <img className="push-notif__image" src={imageUrl.trim()} alt="" />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .push-phone-preview__tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }
        .push-phone-preview__tabs button {
          flex: 1;
          padding: 0.45rem 0.75rem;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text);
          cursor: pointer;
          font-size: 0.85rem;
        }
        .push-phone-preview__tabs button.active {
          background: var(--primary);
          border-color: var(--primary);
          color: #fff;
          font-weight: 600;
        }
        .push-phone-frame {
          width: 100%;
          max-width: 280px;
          margin: 0 auto;
        }
        .push-phone-frame__bezel {
          border-radius: 28px;
          padding: 10px;
          background: #111827;
          box-shadow: 0 12px 40px rgba(0,0,0,0.25);
        }
        .push-phone-frame--ios .push-phone-frame__bezel {
          border-radius: 36px;
          background: #0a0a0a;
        }
        .push-phone-frame__notch {
          height: 10px;
          margin: 0 auto 8px;
          width: 38%;
          border-radius: 999px;
          background: #1f2937;
        }
        .push-phone-frame--ios .push-phone-frame__notch {
          width: 42%;
          height: 18px;
          border-radius: 14px;
          background: #000;
        }
        .push-phone-frame__screen {
          background: linear-gradient(180deg, #1e3a5f 0%, #0f172a 55%, #111827 100%);
          border-radius: 20px;
          min-height: 420px;
          padding: 0.75rem;
        }
        .push-phone-frame__status {
          display: flex;
          justify-content: space-between;
          color: rgba(255,255,255,0.85);
          font-size: 0.7rem;
          margin-bottom: 1rem;
          padding: 0 0.25rem;
        }
        .push-notif {
          background: rgba(255,255,255,0.94);
          color: #111;
          border-radius: 14px;
          padding: 0.75rem 0.85rem;
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        }
        .push-notif--ios {
          border-radius: 18px;
          backdrop-filter: blur(8px);
        }
        .push-notif__app {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.72rem;
          color: #4b5563;
          margin-bottom: 0.35rem;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .push-notif__badge {
          width: 16px;
          height: 16px;
          border-radius: 4px;
          background: #0f4a8c;
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.65rem;
          font-weight: 700;
        }
        .push-notif__time {
          margin-left: auto;
          text-transform: none;
          letter-spacing: 0;
        }
        .push-notif__title {
          font-weight: 700;
          font-size: 0.92rem;
          margin-bottom: 0.2rem;
          line-height: 1.25;
        }
        .push-notif__body {
          font-size: 0.84rem;
          color: #374151;
          line-height: 1.35;
          white-space: pre-wrap;
        }
        .push-notif__image {
          margin-top: 0.55rem;
          width: 100%;
          max-height: 90px;
          object-fit: cover;
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
}
