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
      .style('gap', '20px')
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
      .style('top', '20%')
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
    const items = currentCategory?.items || [];

    // Data bind items
    const itemElements = this.verticalContainer
      .selectAll<HTMLDivElement, any>('.xmb-item')
      .data(items, (d) => d.id);

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

    // Avatar/thumbnail
    itemEnter.append('div')
      .attr('class', 'item-avatar')
      .style('width', '24px')
      .style('height', '24px')
      .style('border-radius', '50%')
      .style('background', 'rgba(255,255,255,0.2)')
      .style('margin-right', '12px')
      .style('flex-shrink', '0');

    // Name
    itemEnter.append('div')
      .attr('class', 'item-name')
      .style('font-size', '14px')
      .style('color', 'rgba(255,255,255,0.9)')
      .style('white-space', 'nowrap')
      .style('overflow', 'hidden')
      .style('text-overflow', 'ellipsis')
      .text((d) => d.singer_name || d.title);

    // Update
    itemElements.merge(itemEnter)
      .select('.item-name')
      .text((d) => d.singer_name || d.title);

    // Exit
    itemElements.exit().remove();
  }

  private updatePositions(state: NavigationState) {
    // Update horizontal position
    const offsetX = -state.cursorX * this.CATEGORY_WIDTH;
    this.horizontalContainer
      .style('transform', `translateX(${offsetX}px)`);

    // Update vertical position
    const offsetY = -state.cursorY * this.ITEM_HEIGHT;
    this.verticalContainer
      .style('transform', `translateY(${offsetY}px)`);
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

    // Update item active states
    this.verticalContainer
      .selectAll<HTMLDivElement, any>('.xmb-item')
      .each(function (d, i) {
        const isActive = i === state.cursorY;
        const item = d3.select(this);

        item.style('background', isActive ? 'rgba(255,255,255,0.1)' : 'transparent');

        item.select('.item-name')
          .style('color', isActive ? '#ffffff' : 'rgba(255,255,255,0.9)')
          .style('font-weight', isActive ? 'bold' : 'normal')
          .style('font-size', isActive ? '16px' : '14px');
      });

    // Re-render items for new category
    this.renderItems(state);
  }

  destroy() {
    this.navigation.removeListener(this.handleNavigationChange);
    this.container.remove();
  }
}
