import * as d3 from 'd3';
import { Category } from '../types';
import { NavigationController, NavigationState } from './NavigationController';

export class XMBInterface {
  private container: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  private horizontalContainer: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  private verticalContainer: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  private navigation: NavigationController;
  private categories: Category[] = [];

  private readonly CATEGORY_WIDTH = 160;
  private readonly CATEGORY_GAP = 20;
  private readonly ITEM_HEIGHT = 55;
  private readonly TRANSITION_DURATION = 300;

  constructor(containerId: string, navigation: NavigationController) {
    this.navigation = navigation;

    // Create main container
    this.container = d3.select(`#${containerId}`)
      .append('div')
      .attr('class', 'xmb-container')
      .style('position', 'relative')
      .style('width', '100vw')
      .style('height', '100vh')
      .style('background', '#1d1d1d')
      .style('overflow', 'hidden')
      .style('color', 'white')
      .style('font-family', '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif');

    // Background glow
    this.container.append('div')
      .attr('class', 'background-glow')
      .style('position', 'absolute')
      .style('top', '0')
      .style('left', '0')
      .style('width', '100%')
      .style('height', '100%')
      .style('background', 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 70%)')
      .style('pointer-events', 'none');

    // Horizontal axis container (categories)
    this.horizontalContainer = this.container.append('div')
      .attr('class', 'horizontal-axis')
      .style('position', 'absolute')
      .style('top', '15%')
      .style('left', '20%')
      .style('display', 'flex')
      .style('gap', `${this.CATEGORY_GAP}px`)
      .style('transition', `transform ${this.TRANSITION_DURATION}ms cubic-bezier(0.2, 0.8, 0.2, 1)`);

    // Vertical list window with mask
    const verticalWindow = this.container.append('div')
      .attr('class', 'vertical-list-window')
      .style('position', 'absolute')
      .style('top', '0')
      .style('left', '0')
      .style('width', '100%')
      .style('height', '65%')
      .style('pointer-events', 'none')
      .style('-webkit-mask-image', 'linear-gradient(to bottom, transparent 5%, black 15%, black 85%, transparent 100%)')
      .style('mask-image', 'linear-gradient(to bottom, transparent 5%, black 15%, black 85%, transparent 100%)')
      .style('z-index', '5');

    // Vertical axis container (items)
    this.verticalContainer = verticalWindow.append('div')
      .attr('class', 'vertical-axis')
      .style('position', 'absolute')
      .style('top', '40%')
      .style('left', '20%')
      .style('display', 'flex')
      .style('flex-direction', 'column')
      .style('width', '400px')
      .style('padding-left', '30px')
      .style('pointer-events', 'auto')
      .style('transition', `transform ${this.TRANSITION_DURATION}ms cubic-bezier(0.2, 0.8, 0.2, 1)`);

    // Listen to navigation changes
    this.navigation.addListener(this.handleNavigationChange);
  }

  setCategories(categories: Category[]) {
    this.categories = categories;
    this.render();
  }

  private handleNavigationChange = (state: NavigationState) => {
    this.updatePositions(state);
    this.updateActiveStates(state);
  };

  private render() {
    this.renderCategories();
    const state = this.navigation.getState();
    this.renderItems(state);
    this.updatePositions(state);
  }

  private renderCategories() {
    // Data bind categories
    const categories = this.horizontalContainer
      .selectAll<HTMLDivElement, Category>('.category')
      .data(this.categories, (d) => d.id);

    // Enter
    const categoryEnter = categories.enter()
      .append('div')
      .attr('class', 'category')
      .style('min-width', `${this.CATEGORY_WIDTH}px`)
      .style('display', 'flex')
      .style('flex-direction', 'column')
      .style('align-items', 'flex-start');

    // Icon
    categoryEnter.append('div')
      .attr('class', 'category-icon')
      .style('font-size', '20px')
      .style('margin-bottom', '5px')
      .text((d) => d.icon || '');

    // Title
    categoryEnter.append('div')
      .attr('class', 'category-title')
      .style('font-size', '16px')
      .style('color', 'rgba(255,255,255,0.6)')
      .style('transition', 'all 0.2s')
      .text((d) => d.title);

    // Active indicator line
    categoryEnter.append('div')
      .attr('class', 'category-indicator')
      .style('width', '80px')
      .style('height', '2px')
      .style('background', 'white')
      .style('margin-top', '10px')
      .style('opacity', '0')
      .style('transition', 'opacity 0.2s');

    // Update
    categories.merge(categoryEnter)
      .select('.category-title')
      .text((d) => d.title);

    // Exit
    categories.exit().remove();
  }

  private renderItems(state: NavigationState) {
    const currentCategory = this.categories[state.cursorX];
    const originalItems = currentCategory?.items || [];

    // Reorder items: item before active at position 0, active at position 1, then loop
    // Like a date picker where selected item is in the middle
    const reorderedItems: any[] = [];
    const len = originalItems.length;

    if (len === 1) {
      // Single item: add empty placeholder at position 0, actual item at position 1
      reorderedItems.push({ id: '__placeholder__', _isPlaceholder: true, _displayIndex: 0 });
      reorderedItems.push({ ...originalItems[0], _displayIndex: 1 });
    } else {
      for (let i = 0; i < len; i++) {
        // Start from one before cursorY, then loop around
        const index = (state.cursorY - 1 + i + len) % len;
        reorderedItems.push({ ...originalItems[index], _displayIndex: i });
      }
    }

    // Clear and re-render all items (force update on navigation)
    this.verticalContainer.selectAll('.xmb-item').remove();

    // Data bind items with reordered list
    const itemElements = this.verticalContainer
      .selectAll<HTMLDivElement, any>('.xmb-item')
      .data(reorderedItems);

    // Enter
    const itemEnter = itemElements.enter()
      .append('div')
      .attr('class', 'xmb-item')
      .style('height', `${this.ITEM_HEIGHT}px`)
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('padding', '0 10px')
      .style('border-radius', '8px')
      .style('transition', 'all 0.2s')
      .style('cursor', 'pointer');

    // Avatar/thumbnail (hide for placeholder, show image if available)
    itemEnter.append('div')
      .attr('class', 'item-avatar')
      .style('width', '24px')
      .style('height', '24px')
      .style('border-radius', '50%')
      .style('background-color', (d) => d._isPlaceholder ? 'transparent' : 'rgba(255,255,255,0.2)')
      .style('background-image', (d) => {
        if (d._isPlaceholder) return 'none';
        if (d.singer_avatar) return `url(${d.singer_avatar})`;
        return 'none';
      })
      .style('background-size', 'cover')
      .style('background-position', 'center')
      .style('margin-right', '12px')
      .style('flex-shrink', '0');

    // Name (skip for placeholder)
    itemEnter.append('div')
      .attr('class', 'item-name')
      .style('white-space', 'nowrap')
      .style('overflow', 'hidden')
      .style('text-overflow', 'ellipsis')
      .text((d) => d._isPlaceholder ? '' : (d.singer_name || d.title));

    // Apply active styling (position 1 is always active - like date picker)
    itemEnter.each(function(d, i) {
      const isActive = i === 1;
      const item = d3.select(this);

      item.style('background', isActive ? 'rgba(255,255,255,0.1)' : 'transparent');

      item.select('.item-name')
        .style('color', isActive ? '#ffffff' : 'rgba(255,255,255,0.9)')
        .style('font-weight', isActive ? 'bold' : 'normal')
        .style('font-size', isActive ? '16px' : '14px');
    });

    // Exit
    itemElements.exit().remove();
  }

  private updatePositions(state: NavigationState) {
    // Update horizontal position (include gap in calculation)
    const offsetX = -state.cursorX * (this.CATEGORY_WIDTH + this.CATEGORY_GAP);
    this.horizontalContainer
      .style('transform', `translateX(${offsetX}px)`);
  }

  private updateActiveStates(state: NavigationState) {
    // Update category active states
    this.horizontalContainer
      .selectAll<HTMLDivElement, Category>('.category')
      .each(function (d, i) {
        const isActive = i === state.cursorX;
        const category = d3.select(this);

        category.select('.category-title')
          .style('color', isActive ? '#ffffff' : 'rgba(255,255,255,0.6)')
          .style('font-weight', isActive ? 'bold' : 'normal')
          .style('font-size', isActive ? '18px' : '16px');

        category.select('.category-indicator')
          .style('opacity', isActive ? '1' : '0');
      });

    // Re-render items (styling is applied in renderItems)
    this.renderItems(state);
  }

  destroy() {
    this.navigation.removeListener(this.handleNavigationChange);
    this.container.remove();
  }
}
