import styled from "@emotion/styled";
import { useCallback, useEffect, useState } from "react";
import { AIVisualizer } from "./components/AIVisualizer";
import { BackgroundVideo } from "./components/BackgroundVideo";
import { XMBContainer } from "./components/XMBContainer";
import { useData } from "./hooks/useData";
import { useXMBNavigation } from "./hooks/useXMBNavigation";
import { Category, Singer, Song } from "./types";

const VisualizerOverlay = styled.div`
  position: absolute;
  bottom: 50px;
  right: 50px;
  z-index: 10;
`;

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
  const [displayCategories, setDisplayCategories] = useState<Category[]>([]);

  // 初期表示用のカテゴリをセット（データロード後に一度だけ）
  useEffect(() => {
    if (!displayCategories.length) {
      if (mode === "songs" && songCategories.length) {
        setDisplayCategories(songCategories);
      } else if (mode === "singers" && singerCategories.length) {
        setDisplayCategories(singerCategories);
      }
    }
  }, [mode, songCategories, singerCategories, displayCategories.length]);

  const navigation = useXMBNavigation(displayCategories);
  const { cursor, currentItem } = navigation;

  const [selectedItem, setSelectedItem] = useState<Singer | Song | null>(null);

  // Sync selectedItem with navigation
  useEffect(() => {
    setSelectedItem(currentItem);
  }, [currentItem]);

  // Handle Pivot (Transpose)
  const handlePivot = useCallback(() => {
    if (
      !selectedItem ||
      !("singer_id" in selectedItem) ||
      !("title" in selectedItem)
    ) {
      return;
    }

    const songItem = selectedItem as Song;
    const newMode: AxisMode = mode === "songs" ? "singers" : "songs";
    const baseCategories =
      newMode === "songs" ? songCategories : singerCategories;

    if (!baseCategories.length) return;

    const currentX = cursor.x;
    const currentY = cursor.y;

    // ベースのカテゴリ配列の中で、同じカバーがどこにあるかを探す
    let baseX = -1;
    let baseY = -1;

    if (newMode === "songs") {
      baseX = baseCategories.findIndex((c) => c.title === songItem.title);
      if (baseX !== -1) {
        baseY = baseCategories[baseX].items.findIndex(
          (i: any) => "singer_id" in i && i.singer_id === songItem.singer_id
        );
      }
    } else {
      baseX = baseCategories.findIndex(
        (c) => c.id === `cat_singer_${songItem.singer_id}`
      );
      if (baseX !== -1) {
        baseY = baseCategories[baseX].items.findIndex(
          (i: any) => "title" in i && (i as Song).title === songItem.title
        );
      }
    }

    if (baseX === -1 || baseY === -1) {
      // うまく見つからない場合は通常の並びに切り替える
      setMode(newMode);
      setDisplayCategories(baseCategories);
      return;
    }

    // 横方向: 対象カテゴリが currentX に来るように回転
    const rotatedCategories = rotateToIndex(baseCategories, baseX, currentX);

    // 縦方向: currentX 上の items を回転させて、対象カバーが currentY に来るようにする
    const targetCategory = rotatedCategories[currentX];
    const items = targetCategory.items;

    if (items.length > 0) {
      const targetY = ((currentY % items.length) + items.length) % items.length;
      const rotatedItems = rotateToIndex(items, baseY, targetY);
      rotatedCategories[currentX] = {
        ...targetCategory,
        items: rotatedItems,
      };
    }

    setMode(newMode);
    setDisplayCategories(rotatedCategories);
  }, [mode, cursor, selectedItem, songCategories, singerCategories]);

  // Listen for Tab key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        handlePivot();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePivot]);

  const getStats = (item: Singer | Song | null) => {
    if (!item) return undefined;
    if ("ai_characteristics" in item) return item.ai_characteristics;
    if ("ai_stats" in item) return item.ai_stats;
    return undefined;
  };

  // Determine Average Stats to show
  const getAverageStats = (item: Singer | Song | null) => {
    if (!item || !("singer_id" in item)) return undefined; // Not a song cover

    if (mode === "songs") {
      // Compare with Song Average
      return (item as Song).average_stats;
    } else {
      // Compare with Singer Average (Characteristics)
      const singer = singers.find((s) => s.id === (item as Song).singer_id);
      return singer?.ai_characteristics;
    }
  };

  if (loading) {
    return (
      <div
        style={{
          color: "white",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div className="App">
      <BackgroundVideo
        videoId={
          selectedItem && "video_url" in selectedItem
            ? selectedItem.video_url
            : undefined
        }
      />

      <ModeIndicator>
        Mode:{" "}
        {mode === "songs"
          ? "Song-centric (Horizontal: Songs)"
          : "Singer-centric (Horizontal: Singers)"}{" "}
        <br />
        Press [Tab] to Pivot
      </ModeIndicator>

      {/* We need to modify XMBContainer to accept external navigation control or pass props */}
      {/* For now, let's assume XMBContainer needs update to accept 'navigation' prop or we lift logic out */}
      {/* Actually, XMBContainer uses useXMBNavigation internally. We should refactor XMBContainer to be controlled or pass the hook result. */}
      {/* Let's Refactor XMBContainer in next step. For now, this code assumes XMBContainer is updated. */}

      <XMBContainer
        categories={displayCategories}
        navigation={navigation}
        displayMode={mode === "songs" ? "show_singer" : "show_song"}
      />

      {selectedItem && (
        <VisualizerOverlay>
          <AIVisualizer
            stats={getStats(selectedItem)}
            averageStats={getAverageStats(selectedItem)}
            title={
              "name" in selectedItem ? selectedItem.name : selectedItem.title
            }
          />
        </VisualizerOverlay>
      )}
    </div>
  );
}

export default App;
