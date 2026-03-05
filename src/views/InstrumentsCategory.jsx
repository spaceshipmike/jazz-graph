import { useLocation } from "react-router-dom";
import CategoryPage from "../components/CategoryPage";
import InstrumentsOverview from "./InstrumentsOverview";
import Eras from "./Eras";

const TABS = [
  { path: "/instruments", label: "Overview" },
  { path: "/instruments/eras", label: "Eras" },
];

export default function InstrumentsCategory() {
  const { pathname } = useLocation();
  const sub = pathname.split("/")[2] || "";

  let panel;
  switch (sub) {
    case "eras":
      panel = <Eras />;
      break;
    default:
      panel = <InstrumentsOverview />;
  }

  return <CategoryPage tabs={TABS}>{panel}</CategoryPage>;
}
