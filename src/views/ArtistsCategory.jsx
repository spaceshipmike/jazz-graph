import { useLocation } from "react-router-dom";
import CategoryPage from "../components/CategoryPage";
import ArtistsOverview from "./ArtistsOverview";
import Network from "./Network";
import ArtistsCareers from "./ArtistsCareers";

const TABS = [
  { path: "/artists", label: "Overview" },
  { path: "/artists/network", label: "Network" },
  { path: "/artists/careers", label: "Careers" },
];

export default function ArtistsCategory() {
  const { pathname } = useLocation();
  const sub = pathname.split("/")[2] || "";

  let panel;
  switch (sub) {
    case "network":
      panel = <Network />;
      break;
    case "careers":
      panel = <ArtistsCareers />;
      break;
    default:
      panel = <ArtistsOverview />;
  }

  return <CategoryPage tabs={TABS}>{panel}</CategoryPage>;
}
