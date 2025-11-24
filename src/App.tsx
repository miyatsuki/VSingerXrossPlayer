import styled from "@emotion/styled";
import { useEffect, useMemo, useState } from "react";
import { VideoDetailCard } from "./components/VideoDetailCard";
import { XMBContainer } from "./components/XMBContainer";
import { YouTubePlayer } from "./components/YouTubePlayer";
import { useData } from "./hooks/useData";
import { useXMBNavigation } from "./hooks/useXMBNavigation";
import { Singer, Song } from "./types";

const ModeIndicator = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  color: white;
  background: rgba(0, 0, 0, 0.5);
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 10;
`;

type AxisMode = "songs" | "singers";

function rotateToIndex<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const length = items.length;
  if (length === 0) return items;

  const normalizedTo = ((toIndex % length) + length) % length;
  const offset = (normalizedTo - fromIndex + length) % length;

  const result = new Array<T>(length);
  for (let i = 0; i < length; i += 1) {
    const srcIndex = (i - offset + length) % length;
    result[i] = items[srcIndex];
  }
  return result;
}

function App() {
  const { songCategories, singerCategories, singers, loading } = useData();
  const [mode, setMode] = useState<AxisMode>("songs");

  const baseCategories = useMemo(() => {
    console.log("[App] baseCategories recalculated:", {
      mode,
      count: mode === "songs" ? songCategories.length : singerCategories.length,
    });
    return mode === "songs" ? songCategories : singerCategories;
  }, [mode, songCategories, singerCategories]);

  const navigation = useXMBNavigation(baseCategories);
  const { currentItem } = navigation;

  console.log("[App] Render:", {
    baseCategoriesCount: baseCategories.length,
    currentItem: currentItem?.id,
    cursor: navigation.cursor,
  });

  const [selectedItem, setSelectedItem] = useState<Singer | Song | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  // Sync selectedItem with navigation
  // Only depend on currentItem?.id to prevent infinite loops from object reference changes
  useEffect(() => {
    console.log("[App] useEffect - sync selectedItem:", {
      currentId: currentItem?.id,
    });
    setSelectedItem(currentItem);
  }, [currentItem?.id]);

  // Listen for Enter key to open YouTube player
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && selectedItem && "video_url" in selectedItem) {
        e.preventDefault();
        setIsPlayerOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItem]);

  if (loading) {
    return (
      <div
        style={{
          color: "white",
          padding: "20px",
          backgroundColor: "#1d1d1d",
          minHeight: "100vh",
        }}
      >
        Loading...
      </div>
    );
  }

  if (baseCategories.length === 0) {
    return (
      <div
        style={{
          color: "white",
          padding: "20px",
          backgroundColor: "#1d1d1d",
          minHeight: "100vh",
        }}
      >
        No data
      </div>
    );
  }

  return (
    <div className="App">
      <ModeIndicator>
        Mode: {mode === "songs" ? "Song-centric" : "Singer-centric"}
      </ModeIndicator>

      <XMBContainer
        categories={baseCategories}
        navigation={navigation}
        displayMode={mode === "songs" ? "show_singer" : "show_song"}
      />

      {selectedItem && "video_url" in selectedItem && (
        <VideoDetailCard
          song={selectedItem as Song}
          singer={singers.find(
            (s) => s.id === (selectedItem as Song).singer_id
          )}
        />
      )}

      {isPlayerOpen && selectedItem && "video_url" in selectedItem && (
        <YouTubePlayer
          videoId={selectedItem.video_url}
          startTime={
            "chorus_start_time" in selectedItem
              ? selectedItem.chorus_start_time
              : undefined
          }
          onClose={() => setIsPlayerOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
