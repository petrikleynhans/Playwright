import "@/index.css";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import FilmsList from "./components/FilmsList";
import ShotGrid from "./components/ShotGrid";
import ShotDetail from "./components/ShotDetail";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FilmsList />} />
        <Route path="/films/:filmId" element={<ShotGrid />} />
        <Route path="/films/:filmId/shots/:shotId" element={<ShotDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
