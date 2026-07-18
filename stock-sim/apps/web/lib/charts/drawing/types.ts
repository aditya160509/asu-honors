export type DrawingToolType =
  | 'trendline'
  | 'horizontalLine'
  | 'verticalLine'
  | 'fibonacciRetracement'
  | 'fibonacciExtension'
  | 'parallelChannel'
  | 'pitchfork'
  | 'rectangle'
  | 'ellipse'
  | 'text'
  | 'arrow'
  | 'callout'
  | 'measure';

export type DrawingState = 'placing' | 'active' | 'selected' | 'dragging';

export interface DrawingPoint {
  time: number;
  price: number;
}

export interface Drawing {
  id: string;
  type: DrawingToolType;
  points: DrawingPoint[];
  state: DrawingState;
  style: DrawingStyle;
  label?: string;
}

export interface DrawingStyle {
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  fillColor?: string;
  fontSize?: number;
}

export const DEFAULT_DRAWING_STYLE: DrawingStyle = {
  color: '#3b82f6',
  lineWidth: 2,
  lineStyle: 'solid',
  fillColor: 'rgba(59, 130, 246, 0.1)',
};
