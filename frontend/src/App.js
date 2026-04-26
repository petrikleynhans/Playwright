import "@/index.css";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import FilmsList from "./components/FilmsList";
import ShotGrid from "./components/ShotGrid";
import ShotDetail from "./components/ShotDetail";
import LessonsPage from "./components/LessonsPage";
import CharactersPage from "./components/CharactersPage";
import CharacterDetail from "./components/CharacterDetail";
import LocationsPage from "./components/LocationsPage";
import LocationDetail from "./components/LocationDetail";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FilmsList />} />
        <Route path="/films/:filmId" element={<ShotGrid />} />
        <Route path="/films/:filmId/shots/:shotId" element={<ShotDetail />} />
        <Route path="/films/:filmId/lessons" element={<LessonsPage />} />
        <Route path="/films/:filmId/characters" element={<CharactersPage />} />
        <Route path="/films/:filmId/characters/:charId" element={<CharacterDetail />} />
        <Route path="/films/:filmId/locations" element={<LocationsPage />} />
        <Route path="/films/:filmId/locations/:locId" element={<LocationDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
