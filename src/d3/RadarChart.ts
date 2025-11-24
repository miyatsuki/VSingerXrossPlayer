import * as d3 from 'd3';
import { AIStats } from '../types';

interface RadarDataPoint {
  axis: string;
  value: number;
  avgValue?: number;
}

export class RadarChart {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private width: number;
  private height: number;
  private radius: number;

  constructor(container: HTMLElement, width: number = 140, height: number = 140) {
    this.width = width;
    this.height = height;
    this.radius = Math.min(width, height) / 2 * 0.7;

    this.svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);
  }

  render(stats: AIStats, averageStats?: AIStats) {
    // Clear previous content
    this.svg.selectAll('*').remove();

    // Prepare data
    const axes = [
      { key: 'cool', label: 'かっこいい' },
      { key: 'cute', label: 'かわいい' },
      { key: 'energetic', label: '元気' },
      { key: 'surprising', label: '意外性' },
      { key: 'emotional', label: 'エモい' },
    ];

    const data: RadarDataPoint[] = axes.map(axis => ({
      axis: axis.label,
      value: (stats as any)[axis.key] || 0,
      avgValue: averageStats ? (averageStats as any)[axis.key] || 0 : undefined,
    }));

    const angleSlice = (Math.PI * 2) / data.length;

    // Scales
    const rScale = d3.scaleLinear()
      .domain([0, 100])
      .range([0, this.radius]);

    // Draw grid circles
    const levels = 5;
    for (let i = 1; i <= levels; i++) {
      this.svg.append('circle')
        .attr('r', this.radius * (i / levels))
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255,255,255,0.2)')
        .attr('stroke-width', 1);
    }

    // Draw axes
    data.forEach((d, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const lineX = Math.cos(angle) * this.radius;
      const lineY = Math.sin(angle) * this.radius;

      // Axis line
      this.svg.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', lineX)
        .attr('y2', lineY)
        .attr('stroke', 'rgba(255,255,255,0.2)')
        .attr('stroke-width', 1);

      // Axis label
      const labelRadius = this.radius * 1.15;
      const labelX = Math.cos(angle) * labelRadius;
      const labelY = Math.sin(angle) * labelRadius;

      this.svg.append('text')
        .attr('x', labelX)
        .attr('y', labelY)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', 'white')
        .attr('font-size', '10px')
        .text(d.axis);
    });

    // Draw average stats (if available)
    if (averageStats) {
      this.drawRadarArea(data, 'avgValue', '#82ca9d', 0.3, true);
    }

    // Draw current stats
    this.drawRadarArea(data, 'value', '#8884d8', 0.5, false);
  }

  private drawRadarArea(
    data: RadarDataPoint[],
    valueKey: 'value' | 'avgValue',
    color: string,
    fillOpacity: number,
    isDashed: boolean
  ) {
    const angleSlice = (Math.PI * 2) / data.length;
    const rScale = d3.scaleLinear()
      .domain([0, 100])
      .range([0, this.radius]);

    // Calculate path
    const pathCoords = data.map((d, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const value = valueKey === 'value' ? d.value : (d.avgValue || 0);
      const r = rScale(value);
      return {
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
      };
    });

    // Create path string
    const pathString = pathCoords.map((coord, i) =>
      i === 0 ? `M ${coord.x} ${coord.y}` : `L ${coord.x} ${coord.y}`
    ).join(' ') + ' Z';

    // Draw area
    this.svg.append('path')
      .attr('d', pathString)
      .attr('fill', color)
      .attr('fill-opacity', fillOpacity)
      .attr('stroke', color)
      .attr('stroke-width', isDashed ? 2 : 3)
      .attr('stroke-dasharray', isDashed ? '5,5' : 'none');
  }

  destroy() {
    this.svg.selectAll('*').remove();
  }
}
