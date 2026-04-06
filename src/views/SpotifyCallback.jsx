import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSpotify } from "../spotify";

export default function SpotifyCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { completeLogin } = useSpotify();
  const [message, setMessage] = useState("Connecting Spotify...");

  useEffect(() => {
    let cancelled = false;

    completeLogin({
      code: searchParams.get("code"),
      state: searchParams.get("state"),
      error: searchParams.get("error"),
    })
      .then((returnTo) => {
        if (!cancelled) navigate(returnTo || "/", { replace: true });
      })
      .catch((error) => {
        if (cancelled) return;
        setMessage(error.message || "Spotify login failed");
        window.setTimeout(() => navigate("/", { replace: true }), 1600);
      });

    return () => {
      cancelled = true;
    };
  }, [completeLogin, navigate, searchParams]);

  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="mono" style={{ color: "var(--fg-muted)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {message}
      </div>
    </div>
  );
}
