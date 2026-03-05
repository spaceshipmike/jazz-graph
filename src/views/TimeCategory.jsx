import { useLocation } from "react-router-dom";
import CategoryPage from "../components/CategoryPage";
import Timeline from "./Timeline";
import TimeDensity from "./TimeDensity";
import TimeEnsembles from "./TimeEnsembles";

const TABS = [
  { path: "/time", label: "Timeline" },
  { path: "/time/density", label: "Density" },
  { path: "/time/ensembles", label: "Ensembles" },
];

export default function TimeCategory() {
  const { pathname } = useLocation();
  const sub = pathname.split("/")[2] || "";

  let panel;
  switch (sub) {
    case "density":
      panel = <TimeDensity />;
      break;
    case "ensembles":
      panel = <TimeEnsembles />;
      break;
    default:
      panel = <Timeline />;
  }

  return <CategoryPage tabs={TABS}>{panel}</CategoryPage>;
}
