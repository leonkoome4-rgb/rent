import { useState } from 'react';
import { Icon } from './Icon';

/**
 * Shows a tenant's one-time PIN with the two ways to hand it over today:
 * a WhatsApp click-to-chat (pre-filled invite) or copying the message.
 * In mock-SMS mode this is how invites actually reach tenants.
 */
export function InviteShare({ name, phone, pin, message, whatsapp, compact = false }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message || `PIN ${pin}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this invite:', message || `PIN ${pin}`);
    }
  }

  return (
    <div className={`invite-share ${compact ? 'compact' : ''}`}>
      <div className="invite-share-main">
        {name && <span className="invite-share-name">{name}</span>}
        {phone && <span className="invite-share-phone">{phone}</span>}
        <span className="invite-share-pin" title="One-time PIN — they'll choose their own on first login">
          PIN <strong>{pin}</strong>
        </span>
      </div>
      <div className="invite-share-actions">
        {whatsapp && (
          <a className="btn-whatsapp" href={whatsapp} target="_blank" rel="noreferrer">
            <Icon name="message" size={14} /> WhatsApp
          </a>
        )}
        {message && (
          <button type="button" className="btn-ghost btn-small" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
}
