import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode } from "lucide-react";
import { useSessionStore } from "../../state/useSessionStore";
import { getPhotoStyle } from "../../data/photoStyles";

const INVITE_DETAILS: Record<string, { label: string; motif: string }> = {
  classic: { label: "An invitation, beautifully simple", motif: "✦" },
  vintage: { label: "A ticket to a little nostalgia", motif: "✧" },
  meme: { label: "Good people. Big main-character energy.", motif: "★" },
  daydream: { label: "Meet me in a daydream", motif: "♡" },
  noir: { label: "Your name is on the guest list", motif: "◆" },
  neon: { label: "Your portal to the after-hours studio", motif: "✴" },
  sunset: { label: "A little sunshine, saved for you", motif: "☀" },
  scrapbook: { label: "One more memory for the collection", motif: "✿" },
};
export default function QrInvite({ code }: { code: string }) {
  const themeId = useSessionStore((s) => s.themePack?.id);
  const studio = getPhotoStyle(themeId);
  const detail = INVITE_DETAILS[studio.id];
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const url = `${window.location.origin}/?join=${encodeURIComponent(code)}`;
  const local =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  useEffect(() => {
    let active = true;
    if (open)
      QRCode.toDataURL(url, {
        width: 256,
        margin: 4,
        errorCorrectionLevel: "M",
        color: { dark: "#17121e", light: "#ffffff" },
      })
        .then((value) => {
          if (active) setImage(value);
        })
        .catch(() => {
          if (active)
            setError(
              "Could not create the QR code. Use the invitation link instead.",
            );
        });
    return () => {
      active = false;
    };
  }, [url, open]);
  return (
    <div className="qr-invite">
      <button
        className="action-secondary"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <QrCode size={16} />
        {open ? "Hide QR code" : "Scan to join"}
      </button>
      {open && (
        <div className="qr-invite-card" data-studio={studio.id}>
          <span className="qr-invite-edition">
            {studio.name} · Studio invitation
          </span>
          <div className="qr-invite-print">
            <span className="qr-invite-motif" aria-hidden="true">
              {detail.motif}
            </span>
            {image ? (
              <img
                src={image}
                width={192}
                height={192}
                alt={`Scan to join PeeDate room ${code}`}
              />
            ) : (
              <p role="status">{error || "Creating invitation…"}</p>
            )}
            <span className="qr-invite-room">ROOM {code}</span>
          </div>
          <strong>{detail.label}</strong>
          <p>
            {local
              ? "This local preview link only opens on this computer. Use the deployed app for a phone-scannable invite."
              : "Open your phone’s camera and scan. Then enter your name to join."}
          </p>
          <a href={url}>{url}</a>
        </div>
      )}
    </div>
  );
}
