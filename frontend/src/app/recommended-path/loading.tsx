import RecommendedPathBuildingScreen from "@/components/RecommendedPathBuildingScreen";

/**
 * Full-screen loader for `/recommended-path` while the server segment resolves.
 * Animation styles in globals.css (`loading-bar-indeterminate`, pulse rings).
 */

export default function RecommendedPathLoading() {
  return <RecommendedPathBuildingScreen />;
}
