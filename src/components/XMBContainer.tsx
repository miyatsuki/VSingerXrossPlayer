import styled from '@emotion/styled';
import React, { useEffect } from 'react';
import { Category } from '../types';
import { XMBCategory } from './XMBCategory';
import { XMBItem } from './XMBItem';

// Define the shape of the navigation object returned by the hook
interface Navigation {
  cursor: { x: number; y: number };
  currentCategory: Category;
  currentItem: any;
  moveLeft: () => void;
  moveRight: () => void;
  moveUp: () => void;
  moveDown: () => void;
}

interface XMBContainerProps {
  categories: Category[];
  navigation: Navigation; // Accept navigation from parent
  onItemSelect?: (item: any) => void;
  displayMode?: 'show_singer' | 'show_song';
}

const Container = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  background: #1d1d1d;
  overflow: hidden;
  color: white;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  z-index: 1;
`;

const HorizontalAxis = styled.div<{ offsetX: number }>`
  position: absolute;
  top: 15%;
  left: 20%;
  display: flex;
  transform: translateX(${props => props.offsetX}px);
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  gap: 20px;
`;

const VerticalListWindow = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 65%; /* Restrict height to avoid overlapping with the card at the bottom */
  pointer-events: none;
  /* 
     Mask gradient:
     - Transparent at very top (0-10%)
     - Visible around the intersection point (20%) -> Start visibility earlier (15%)
     - Fade out towards bottom
  */
  mask-image: linear-gradient(to bottom, transparent 5%, black 15%, black 85%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, transparent 5%, black 15%, black 85%, transparent 100%);
  z-index: 5;
`;

const VerticalAxis = styled.div<{ offsetY: number }>`
  position: absolute;
  top: 20%; /* Align with HorizontalAxis (which is at 20%) */
  left: 20%;
  display: flex;
  flex-direction: column;
  transform: translateY(${props => props.offsetY}px);
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  width: 400px;
  padding-left: 30px;
  pointer-events: auto;
`;

const BackgroundGlow = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 70%);
  pointer-events: none;
`;

export const XMBContainer: React.FC<XMBContainerProps> = ({ categories, navigation, onItemSelect, displayMode = 'show_singer' }) => {
  const { cursor, currentCategory, currentItem, moveLeft, moveRight, moveUp, moveDown } = navigation;
  
  // Calculate offsets to keep active item centered
  // Assuming category width ~160px (100px min-width + padding)
  const categoryWidth = 160; 
  const offsetX = -cursor.x * categoryWidth;

  // Assuming item height ~55px (padding + content + margin)
  const itemHeight = 55;
  const offsetY = -cursor.y * itemHeight;

  useEffect(() => {
    // Only call onItemSelect if currentItem is valid
    if (currentItem && onItemSelect) {
      onItemSelect(currentItem);
    } else if (!currentItem && onItemSelect) {
      // Handle case where category has no items or empty selection
       onItemSelect(null);
    }
  }, [currentItem, onItemSelect]);

  return (
    <Container>
      <BackgroundGlow />
      
      <HorizontalAxis offsetX={offsetX}>
        {categories.map((cat, index) => (
          <XMBCategory 
            key={cat.id} 
            category={cat} 
            isActive={index === cursor.x} 
          />
        ))}
      </HorizontalAxis>

      <VerticalListWindow>
        <VerticalAxis offsetY={offsetY}>
          {currentCategory?.items.map((item, index) => (
            <XMBItem 
              key={item.id} 
              item={item} 
              isActive={index === cursor.y}
              displayMode={displayMode}
              onClick={() => {
                  // Optional: Click support (though XMB is keyboard first)
              }}
            />
          ))}
        </VerticalAxis>
      </VerticalListWindow>
    </Container>
  );
};
