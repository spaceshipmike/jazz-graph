import { useLocation } from "react-router-dom";
import CategoryPage from "../components/CategoryPage";
import SoundDurations from "./SoundDurations";
import SoundByEra from "./SoundByEra";
import SoundTrackCounts from "./SoundTrackCounts";

const TABS = [
  { path: "/sound", label: "Durations" },
  { path: "/sound/by-era", label: "By Era" },
  { path: "/sound/tracks", label: "Track Counts" },
];

export default function SoundCategory() {
  const { pathname } = useLocation();
  const sub = pathname.split("/")[2] || "";

  let panel;
  switch (sub) {
    case "by-era":
      panel = <SoundByEra />;
      break;
    case "tracks":
      panel = <SoundTrackCounts />;
      break;
    default:
      panel = <SoundDurations />;
  }

  return <CategoryPage tabs={TABS}>{panel}</CategoryPage>;
}
