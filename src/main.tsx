import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import App from "./app/App.tsx";
import ScanLanding from "./app/pages/ScanLanding.tsx";
import Kiosk from "./app/pages/Kiosk.tsx";
import DevPreview from "./app/pages/DevPreview.tsx";
import DevCityPreview from "./app/pages/DevCityPreview.tsx";
import DevKioskProgress from "./app/pages/DevKioskProgress.tsx";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/s/:token" element={<ScanLanding />} />
      <Route path="/kiosk" element={<Kiosk />} />
      {/* Dev-only block-count preview tool — import.meta.env.DEV is statically
          replaced with `false` in production builds, so Rollup dead-code-eliminates
          this branch (and the now-unreferenced DevPreview import/module) entirely;
          the route and its code don't exist in `pnpm build` output. */}
      {import.meta.env.DEV && <Route path="/dev/preview" element={<DevPreview />} />}
      {import.meta.env.DEV && <Route path="/dev/city" element={<DevCityPreview />} />}
      {import.meta.env.DEV && <Route path="/dev/kiosk-progress" element={<DevKioskProgress />} />}
    </Routes>
  </BrowserRouter>,
);
