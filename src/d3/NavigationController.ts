import { Category } from '../types';

export interface NavigationState {
  cursorX: number;
  cursorY: number;
}

export type NavigationCallback = (state: NavigationState, currentItem: any) => void;

export class NavigationController {
  private state: NavigationState = { cursorX: 0, cursorY: 0 };
  private categories: Category[] = [];
  private listeners: Set<NavigationCallback> = new Set();
  private isEnabled = true;

  constructor(categories: Category[]) {
    this.categories = categories;
    this.setupKeyboardListeners();
  }

  updateCategories(categories: Category[]) {
    this.categories = categories;
    // Clamp cursor to valid range
    if (categories.length > 0) {
      this.state.cursorX = Math.min(this.state.cursorX, categories.length - 1);
      this.state.cursorX = Math.max(0, this.state.cursorX);

      const currentCat = categories[this.state.cursorX];
      if (currentCat && currentCat.items.length > 0) {
        this.state.cursorY = Math.min(this.state.cursorY, currentCat.items.length - 1);
        this.state.cursorY = Math.max(0, this.state.cursorY);
      } else {
        this.state.cursorY = 0;
      }
    } else {
      this.state = { cursorX: 0, cursorY: 0 };
    }
    this.notifyListeners();
  }

  getState(): NavigationState {
    return { ...this.state };
  }

  getCurrentItem(): any {
    const { cursorX, cursorY } = this.state;
    if (cursorX < 0 || cursorX >= this.categories.length) return null;
    const category = this.categories[cursorX];
    if (!category || cursorY < 0 || cursorY >= category.items.length) return null;
    return category.items[cursorY];
  }

  getCurrentCategory(): Category | null {
    const { cursorX } = this.state;
    if (cursorX < 0 || cursorX >= this.categories.length) return null;
    return this.categories[cursorX];
  }

  addListener(callback: NavigationCallback) {
    this.listeners.add(callback);
  }

  removeListener(callback: NavigationCallback) {
    this.listeners.delete(callback);
  }

  enable() {
    this.isEnabled = true;
  }

  disable() {
    this.isEnabled = false;
  }

  private notifyListeners() {
    const currentItem = this.getCurrentItem();
    this.listeners.forEach(listener => listener(this.state, currentItem));
  }

  private setupKeyboardListeners() {
    window.addEventListener('keydown', this.handleKeyDown);
  }

  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    this.listeners.clear();
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.isEnabled) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this.moveLeft();
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.moveRight();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.moveUp();
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.moveDown();
        break;
    }
  };

  private moveLeft() {
    if (this.categories.length === 0) return;

    const newX = (this.state.cursorX - 1 + this.categories.length) % this.categories.length;
    const targetCategory = this.categories[newX];
    const itemsLength = targetCategory?.items.length ?? 0;
    const newY = itemsLength > 0 ? Math.min(this.state.cursorY, itemsLength - 1) : 0;

    this.state = { cursorX: newX, cursorY: newY };
    this.notifyListeners();
  }

  private moveRight() {
    if (this.categories.length === 0) return;

    const newX = (this.state.cursorX + 1) % this.categories.length;
    const targetCategory = this.categories[newX];
    const itemsLength = targetCategory?.items.length ?? 0;
    const newY = itemsLength > 0 ? Math.min(this.state.cursorY, itemsLength - 1) : 0;

    this.state = { cursorX: newX, cursorY: newY };
    this.notifyListeners();
  }

  private moveUp() {
    const currentCategory = this.categories[this.state.cursorX];
    if (!currentCategory || currentCategory.items.length === 0) return;

    const length = currentCategory.items.length;
    const newY = (this.state.cursorY - 1 + length) % length;

    this.state = { ...this.state, cursorY: newY };
    this.notifyListeners();
  }

  private moveDown() {
    const currentCategory = this.categories[this.state.cursorX];
    if (!currentCategory || currentCategory.items.length === 0) return;

    const length = currentCategory.items.length;
    const newY = (this.state.cursorY + 1) % length;

    this.state = { ...this.state, cursorY: newY };
    this.notifyListeners();
  }
}
