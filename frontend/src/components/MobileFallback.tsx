import "./MobileFallback.css";

export default function MobileFallback() {
  return (
    <div className="app-mobile-fallback" role="alert">
      <div className="app-mobile-fallback__icon" aria-hidden="true">
        🖥️
      </div>
      <h1 className="app-mobile-fallback__heading">
        OmniAgent works best on desktop
      </h1>
      <p className="app-mobile-fallback__body">Mobile support coming soon.</p>
    </div>
  );
}
