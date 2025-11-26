import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import SubmitPaper from "./components/SubmitPaper";
import PapersList from "./components/PapersList";
import PaperDetail from "./components/PaperDetail";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-b from-red-900 via-black to-black text-white">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/submit" element={<SubmitPaper />} />
          <Route path="/papers" element={<PapersList />} />
          <Route path="/papers/:id" element={<PaperDetail />} />
        </Routes>
      </div>
    </Router>
  );
}
