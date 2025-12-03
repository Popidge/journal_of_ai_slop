import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import SubmitPaper from "./components/SubmitPaper";
import PapersList from "./components/PapersList";
import PaperDetail from "./components/PaperDetail";
import NavigationBar from "./components/NavigationBar";
import AboutPage from "./components/AboutPage";
import FaqPage from "./components/FaqPage";
import ContentPolicyPage from "./components/ContentPolicyPage";
import MissionStatementPage from "./components/MissionStatementPage";
import LicensingPage from "./components/LicensingPage";
import PrivacyPolicyPage from "./components/PrivacyPolicyPage";
import SiteFooter from "./components/SiteFooter";
import EcoModeBanner from "./components/EcoModeBanner";
import SustainabilityPage from "./components/SustainabilityPage";
import EditorMessagesPage from "./components/EditorMessagesPage";
import { EcoModeProvider } from "./contexts/EcoModeContext";
import { useEcoMode } from "./hooks/useEcoMode";
import { Analytics } from "@vercel/analytics/react";

function EcoModeOverlay() {
  const { ecoMode } = useEcoMode();
  if (!ecoMode) {
    return null;
  }
  return <div className="eco-mode-overlay pointer-events-none" aria-hidden="true" />;
}

export default function App() {
  return (
    <EcoModeProvider>
      <Router>
        <div className="relative min-h-screen bg-transparent px-2 sm:px-0">
          <EcoModeOverlay />
          <div className="mx-auto w-full max-w-[1200px] px-2 py-6 sm:px-6 lg:px-8">
            <div className="bg-[color:var(--paper)] border border-[color:var(--coffee-light)] shadow-[0_8px_25px_rgba(35,24,21,0.18)] rounded-[24px] p-3 sm:rounded-[32px] sm:p-6 lg:p-8 relative z-10">
              <NavigationBar />
              <EcoModeBanner />
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/submit" element={<SubmitPaper />} />
                <Route path="/papers" element={<PapersList />} />
                <Route path="/papers/:id" element={<PaperDetail />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/content-policy" element={<ContentPolicyPage />} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/mission-statement" element={<MissionStatementPage />} />
                <Route path="/messages" element={<EditorMessagesPage />} />

                <Route path="/licensing" element={<LicensingPage />} />
                <Route path="/sustainability" element={<SustainabilityPage />} />
              </Routes>
            </div>
            <SiteFooter />
          </div>
        </div>
        <Analytics />
      </Router>
    </EcoModeProvider>
  );
}
