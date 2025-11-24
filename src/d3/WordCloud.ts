import * as d3 from 'd3';
import cloud from 'd3-cloud';
import { CommentWord } from '../types';

export class WordCloud {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private width: number;
  private height: number;

  constructor(container: HTMLElement, width: number = 280, height: number = 180) {
    this.width = width;
    this.height = height;

    this.svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);
  }

  render(words?: CommentWord[]) {
    if (!words || words.length === 0) {
      return;
    }

    // Clear previous content
    this.svg.selectAll('*').remove();

    // Prepare data for d3-cloud
    const cloudWords = words.map(w => ({
      text: w.word,
      size: this.calculateFontSize(w.priority),
    }));

    // Create word cloud layout
    const layout = cloud()
      .size([this.width, this.height])
      .words(cloudWords)
      .padding(5)
      .rotate(() => 0)
      .font('Segoe UI')
      .fontSize(d => d.size)
      .on('end', (words) => this.draw(words));

    layout.start();
  }

  private calculateFontSize(priority: number): number {
    // Map priority (0-10) to font size (12-32)
    const minSize = 12;
    const maxSize = 32;
    return minSize + (priority / 10) * (maxSize - minSize);
  }

  private draw(words: any[]) {
    // Color scale based on size
    const colorScale = d3.scaleLinear<string>()
      .domain([12, 32])
      .range(['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.9)']);

    this.svg.selectAll('text')
      .data(words)
      .enter()
      .append('text')
      .style('font-size', d => `${d.size}px`)
      .style('font-family', 'Segoe UI')
      .style('fill', d => colorScale(d.size))
      .attr('text-anchor', 'middle')
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
      .text(d => d.text);
  }

  destroy() {
    this.svg.selectAll('*').remove();
  }
}
