"use client";

export default function LogoutButton() {
  const doLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // force une navigation "pleine" pour que le layout se régénère avec les bons cookies
      window.location.href = "/login";
    }
  };

  return (
    <button
      onClick={doLogout}
      className="rounded bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
      aria-label="Logout"
      title="Logout"
    >
      Logout
    </button>
  );
}
