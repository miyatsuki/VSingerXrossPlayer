import styled from '@emotion/styled';
import { useState } from 'react';
import { AIVisualizer } from './components/AIVisualizer';
import { BackgroundVideo } from './components/BackgroundVideo';
import { XMBContainer } from './components/XMBContainer';
import { Singer, Song } from './types';

import { useData } from './hooks/useData';

const VisualizerOverlay = styled.div`
  position: absolute;
  bottom: 50px;
  right: 50px;
  z-index: 10;
`;

function App() {
  const { categories, loading } = useData();
  const [selectedItem, setSelectedItem] = useState<Singer | Song | null>(null);

  const getStats = (item: Singer | Song | null) => {
    if (!item) return undefined;
    if ('ai_characteristics' in item) return item.ai_characteristics;
    if ('ai_stats' in item) return item.ai_stats;
    return undefined;
  };

  if (loading) {
    return <div style={{ color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  return (
    <div className="App">
      <BackgroundVideo videoId={selectedItem && 'video_url' in selectedItem ? selectedItem.video_url : undefined} />
      
      <XMBContainer 
        categories={categories} 
        onItemSelect={setSelectedItem}
      />
      
      {selectedItem && (
        <VisualizerOverlay>
          <AIVisualizer 
            stats={getStats(selectedItem)} 
            averageStats={'average_stats' in selectedItem ? selectedItem.average_stats : undefined}
            title={'name' in selectedItem ? selectedItem.name : selectedItem.title}
          />
        </VisualizerOverlay>
      )}
    </div>
  );
}

export default App;
