import RecommendedPathBuildingScreen from "@/components/RecommendedPathBuildingScreen";

/**
 * Full-screen loader for `/recommended-path` while the route segment resolves.
 * Pulse rings + bar: `globals.css`.
 */

export default function RecommendedPathLoading() {
  return <RecommendedPathBuildingScreen />;
}
