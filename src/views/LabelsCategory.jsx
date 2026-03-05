import { useLocation } from "react-router-dom";
import CategoryPage from "../components/CategoryPage";
import LabelsOverview from "./LabelsOverview";
import Gallery from "./Gallery";
import Flow from "./Flow";

const TABS = [
  { path: "/labels", label: "Overview" },
  { path: "/labels/browse", label: "Browse" },
  { path: "/labels/flow", label: "Flow" },
];

export default function LabelsCategory() {
  const { pathname } = useLocation();
  const sub = pathname.split("/")[2] || "";

  let panel;
  switch (sub) {
    case "browse":
      panel = <Gallery />;
      break;
    case "flow":
      panel = <Flow />;
      break;
    default:
      panel = <LabelsOverview />;
  }

  return <CategoryPage tabs={TABS}>{panel}</CategoryPage>;
}
