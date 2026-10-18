import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";
import { useRoomStore } from "../../state/useRoomStore";
import { useSessionStore } from "../../state/useSessionStore";
import { socket } from "../../lib/socket";
import { publishStage } from "../../lib/session";
import ReturnToSetupDialog from "./ReturnToSetupDialog";

export default function BackButton() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { roomCode, isHost, status, connectionStatus } = useRoomStore();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [setupRequest, setSetupRequest] = useState<{
    code: string;
    roundId: string | null;
  } | null>(null);
  const stages: Record<string, string> = {
    "/filter": "editor",
    "/decorate": "filter",
    "/export": "decorate",
    "/done": "export",
  };
  const sharedStep = ["/capture", "/editor", ...Object.keys(stages)].includes(
    pathname,
  );
  const disabled =
    pending ||
    (pathname === "/" && !roomCode) ||
    status === "capturing" ||
    (sharedStep && isHost && connectionStatus !== "joined");
  const label =
    pathname === "/" ? (roomCode ? "Back to room" : "Home") : "Back";
  const back = () => {
    setError("");
    if (pathname === "/") {
      navigate("/lobby");
      return;
    }
    if (!isHost || status === "closed" || pathname === "/lobby") {
      navigate("/");
      return;
    }
    if (pathname === "/design") {
      navigate("/layout");
      return;
    }
    if (pathname === "/layout" || pathname === "/theme") {
      navigate("/lobby");
      return;
    }
    if (stages[pathname]) {
      publishStage(stages[pathname], () => navigate(`/${stages[pathname]}`));
      return;
    }
    if (pathname === "/capture" || pathname === "/editor") {
      if (pathname === "/editor") {
        if (roomCode)
          setSetupRequest({
            code: roomCode,
            roundId: useRoomStore.getState().roundId,
          });
        return;
      }
      if (!roomCode) return;
      const design = useSessionStore.getState().designPreset;
      setPending(true);
      socket
        .timeout(8000)
        .emit(
          "update-room-state",
          { code: roomCode, status: "waiting" },
          (timeout, ack) => {
            setPending(false);
            if (timeout)
              setError(
                "Back was not confirmed. Check your connection and try again.",
              );
            else if (!ack.ok) setError(ack.error.message);
            else {
              if (design) useSessionStore.getState().setDesignPreset(design);
              navigate("/layout");
            }
          },
        );
      return;
    }
    navigate("/lobby");
  };
  return (
    <div className="global-back-wrap">
      <button
        className="global-back"
        type="button"
        onClick={back}
        disabled={disabled}
        title={
          status === "capturing"
            ? "Finish the current round before going back"
            : pathname === "/lobby"
              ? "Back home — your room stays open"
              : "Go to the previous step"
        }
      >
        {pathname === "/" && !roomCode ? (
          <Home size={18} />
        ) : (
          <ArrowLeft size={19} />
        )}
        <span>{pending ? "Going back…" : label}</span>
      </button>
      {error && (
        <span className="global-back-error" role="alert">
          {error}
        </span>
      )}
      {setupRequest && (
        <ReturnToSetupDialog
          request={setupRequest}
          onClose={() => setSetupRequest(null)}
          onReturned={() => {
            setSetupRequest(null);
            navigate("/layout");
          }}
        />
      )}
    </div>
  );
}
