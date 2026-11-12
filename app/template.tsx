/** Re-mounts on every navigation, so each page enters with the same short fade and a quick warp of light. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* outside the faded wrapper: a transformed parent would turn "fixed" into "relative to the page" */}
      <div className="page-warp" aria-hidden />
      <div className="animate-fadeUp">{children}</div>
    </>
  );
}
