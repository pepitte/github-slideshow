"use client";

// Permet au visiteur de revenir sur son choix de consentement (bannière ré-affichée).
export default function ConsentReset() {
  return (
    <button
      type="button"
      className="text-sm font-semibold text-leaf-700 underline"
      onClick={() => {
        localStorage.removeItem("consent-meta");
        window.location.href = "/";
      }}
    >
      Modifier mon choix concernant les cookies
    </button>
  );
}
