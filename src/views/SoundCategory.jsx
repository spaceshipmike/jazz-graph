import { useLocation } from "react-router-dom";
import CategoryPage from "../components/CategoryPage";
import SoundCombos from "./SoundCombos";
import SoundDurations from "./SoundDurations";
import SoundByEra from "./SoundByEra";
import SoundTrackCounts from "./SoundTrackCounts";

const TABS = [
  { path: "/sound", label: "Combos" },
  { path: "/sound/durations", label: "Durations" },
  { path: "/sound/by-era", label: "By Era" },
  { path: "/sound/tracks", label: "Track Counts" },
];

export default function SoundCategory() {
  const { pathname } = useLocation();
  const sub = pathname.split("/")[2] || "";

  let panel;
  switch (sub) {
    case "durations":
      panel = <SoundDurations />;
      break;
    case "by-era":
      panel = <SoundByEra />;
      break;
    case "tracks":
      panel = <SoundTrackCounts />;
      break;
    default:
      panel = <SoundCombos />;
  }

  return <CategoryPage tabs={TABS}>{panel}</CategoryPage>;
}
