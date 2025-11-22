import { useState, useCallback, useEffect } from 'react';
import { Category } from '../types';

interface XMBNavigationState {
  x: number;
  y: number;
}

export const useXMBNavigation = (categories: Category[]) => {
  const [cursor, setCursor] = useState<XMBNavigationState>({ x: 0, y: 0 });

  const moveLeft = useCallback(() => {
    setCursor(prev => {
      const length = categories.length;
      if (length === 0) return prev;

      const newX = (prev.x - 1 + length) % length;
      const targetCategory = categories[newX];
      const itemsLength = targetCategory?.items.length ?? 0;
      const newY =
        itemsLength > 0 ? Math.min(prev.y, itemsLength - 1) : 0;

      return { x: newX, y: newY };
    });
  }, [categories]);

  const moveRight = useCallback(() => {
    setCursor(prev => {
      const length = categories.length;
      if (length === 0) return prev;

      const newX = (prev.x + 1) % length;
      const targetCategory = categories[newX];
      const itemsLength = targetCategory?.items.length ?? 0;
      const newY =
        itemsLength > 0 ? Math.min(prev.y, itemsLength - 1) : 0;

      return { x: newX, y: newY };
    });
  }, [categories]);

  const moveUp = useCallback(() => {
    setCursor(prev => {
      const currentCategory = categories[prev.x];
      if (!currentCategory || currentCategory.items.length === 0) {
        return prev;
      }

      const length = currentCategory.items.length;
      const newY = (prev.y - 1 + length) % length;
      return { ...prev, y: newY };
    });
  }, [categories]);

  const moveDown = useCallback(() => {
    setCursor(prev => {
      const currentCategory = categories[prev.x];
      if (!currentCategory || currentCategory.items.length === 0) {
        return prev;
      }

      const length = currentCategory.items.length;
      const newY = (prev.y + 1) % length;
      return { ...prev, y: newY };
    });
  }, [categories]);

  // Keyboard event listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          moveLeft();
          break;
        case 'ArrowRight':
          moveRight();
          break;
        case 'ArrowUp':
          moveUp();
          break;
        case 'ArrowDown':
          moveDown();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveLeft, moveRight, moveUp, moveDown]);

  return {
    cursor,
    currentCategory: categories[cursor.x],
    currentItem: categories[cursor.x]?.items[cursor.y],
    moveLeft,
    moveRight,
    moveUp,
    moveDown,
    setCursor,
  };
};
