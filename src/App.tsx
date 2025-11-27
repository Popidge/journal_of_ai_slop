import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import SubmitPaper from "./components/SubmitPaper";
import PapersList from "./components/PapersList";
import PaperDetail from "./components/PaperDetail";
import NavigationBar from "./components/NavigationBar";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-transparent px-2 sm:px-0">
        <div className="mx-auto w-full max-w-[1080px] px-2 py-6 sm:px-6 lg:px-8">
          <div className="bg-[color:var(--paper)] border border-[color:var(--coffee-light)] shadow-[0_8px_25px_rgba(35,24,21,0.18)] rounded-[24px] p-3 sm:rounded-[32px] sm:p-6 lg:p-8">
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
