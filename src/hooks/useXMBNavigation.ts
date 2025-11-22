import { useState, useCallback, useEffect } from 'react';
import { Category } from '../types';

interface XMBNavigationState {
	x: number;
	y: number;
}

export const useXMBNavigation = (categories: Category[]) => {
	const [cursor, setCursor] = useState<XMBNavigationState>({ x: 0, y: 0 });

	const moveLeft = useCallback(() => {
		setCursor((prev) => {
			const newX = Math.max(0, prev.x - 1);
			return { x: newX, y: 0 }; // Reset Y when changing category
		});
	}, []);

	const moveRight = useCallback(() => {
		setCursor((prev) => {
			const newX = Math.min(categories.length - 1, prev.x + 1);
			return { x: newX, y: 0 };
		});
	}, [categories.length]);

	const moveUp = useCallback(() => {
		setCursor((prev) => {
			const newY = Math.max(0, prev.y - 1);
			return { ...prev, y: newY };
		});
	}, []);

	const moveDown = useCallback(() => {
		setCursor((prev) => {
			const currentCategory = categories[prev.x];
			if (!currentCategory) return prev;

			const newY = Math.min(currentCategory.items.length - 1, prev.y + 1);
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
	};
};
