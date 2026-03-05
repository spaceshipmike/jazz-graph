import { useLocation } from "react-router-dom";
import CategoryPage from "../components/CategoryPage";
import WordsGeography from "./WordsGeography";
import WordsMood from "./WordsMood";
import WordsVocabulary from "./WordsVocabulary";
import WordsImagery from "./WordsImagery";

const TABS = [
  { path: "/words", label: "Geography" },
  { path: "/words/mood", label: "Mood" },
  { path: "/words/vocabulary", label: "Vocabulary" },
  { path: "/words/imagery", label: "Imagery" },
];

export default function WordsCategory() {
  const { pathname } = useLocation();
  const sub = pathname.split("/")[2] || "";

  let panel;
  switch (sub) {
    case "mood":
      panel = <WordsMood />;
      break;
    case "vocabulary":
      panel = <WordsVocabulary />;
      break;
    case "imagery":
      panel = <WordsImagery />;
      break;
    default:
      panel = <WordsGeography />;
  }

  return <CategoryPage tabs={TABS}>{panel}</CategoryPage>;
}
