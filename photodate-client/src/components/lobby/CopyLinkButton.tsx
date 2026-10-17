import { useEffect, useRef, useState } from 'react';
import { Link2, Check } from 'lucide-react';
interface CopyLinkButtonProps { code: string; }
const SLOT_COLORS = ['#e0427c', '#7c6de0', '#42c4e0', '#60e042'];
export default function CopyLinkButton({ code }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?join=${encodeURIComponent(code)}`);
      setCopied(true); setError(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch { setError(true); }
  };
  return <div><button id="copy-link-btn" className="btn btn-secondary" onClick={handleCopy}>{copied ? <Check size={14} /> : <Link2 size={14} />} {copied ? 'Link copied!' : 'Copy invite link'}</button><span role="status" style={{ display: 'block', fontSize: 12 }}>{error && `Could not copy. Share this link: ${window.location.origin}/?join=${encodeURIComponent(code)}`}</span></div>;
}
export { SLOT_COLORS };
