// Auto-replaced by deploy bot — see git-helper Edge Function
// Renders the landing page from the Supabase Edge Function in an iframe.
// To revert: git revert this commit, or replace with a normal page component.

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  return (
    <iframe
      src="https://mrdnioqfgtyiyonoaafg.supabase.co/functions/v1/landing"
      title="TaskFlow AI"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        border: "none",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        zIndex: 9999,
      }}
    />
  );
}
