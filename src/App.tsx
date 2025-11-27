import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import SubmitPaper from "./components/SubmitPaper";
import PapersList from "./components/PapersList";
import PaperDetail from "./components/PaperDetail";
import NavigationBar from "./components/NavigationBar";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-transparent">
        <div className="mx-auto max-w-[1040px] px-4 py-8 sm:px-6">
          <div className="bg-[color:var(--paper)] border border-[color:var(--coffee-light)] shadow-[0_8px_25px_rgba(35,24,21,0.18)] rounded-[32px] p-4 sm:p-8">
            <NavigationBar />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/submit" element={<SubmitPaper />} />
              <Route path="/papers" element={<PapersList />} />
              <Route path="/papers/:id" element={<PaperDetail />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}
