import styled from '@emotion/styled';
import React, { useEffect } from 'react';
import { useXMBNavigation } from '../hooks/useXMBNavigation';
import { Category } from '../types';
import { XMBCategory } from './XMBCategory';
import { XMBItem } from './XMBItem';

interface XMBContainerProps {
  categories: Category[];
  onItemSelect?: (item: any) => void;
}

const Container = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%);
  overflow: hidden;
  color: white;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
`;

const HorizontalAxis = styled.div<{ offsetX: number }>`
  position: absolute;
  top: 20%;
  left: 50%;
  display: flex;
  transform: translateX(calc(-50% + ${props => props.offsetX}px));
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  gap: 20px;
`;

const VerticalAxis = styled.div<{ offsetY: number }>`
  position: absolute;
  top: 35%;
  left: 50%;
  display: flex;
  flex-direction: column;
  transform: translateY(${props => props.offsetY}px);
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  width: 400px;
  margin-left: -20px; /* Align with category center roughly */
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

export const XMBContainer: React.FC<XMBContainerProps> = ({ categories, onItemSelect }) => {
  const { cursor, currentCategory, currentItem, moveLeft, moveRight, moveUp, moveDown } = useXMBNavigation(categories);
  
  // Calculate offsets to keep active item centered
  // Assuming category width ~160px (100px min-width + padding)
  const categoryWidth = 160; 
  const offsetX = -cursor.x * categoryWidth;

  // Assuming item height ~70px (padding + content + margin)
  const itemHeight = 70;
  const offsetY = -cursor.y * itemHeight;

  useEffect(() => {
    if (currentItem && onItemSelect) {
      onItemSelect(currentItem);
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

      <VerticalAxis offsetY={offsetY}>
        {currentCategory?.items.map((item, index) => (
          <XMBItem 
            key={item.id} 
            item={item} 
            isActive={index === cursor.y}
            onClick={() => {
                // Optional: Click support (though XMB is keyboard first)
            }}
          />
        ))}
      </VerticalAxis>
      
      <div style={{ position: 'absolute', bottom: 20, right: 20, opacity: 0.5 }}>
        Use Arrow Keys to Navigate
      </div>
    </Container>
  );
};
