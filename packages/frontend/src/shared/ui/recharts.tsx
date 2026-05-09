'use client';

import dynamic from 'next/dynamic';
import type { ComponentType, ReactNode } from 'react';

type ChartComponentProps = Record<string, unknown> & {
  children?: ReactNode;
};

type RechartsComponentName =
  | 'Area'
  | 'AreaChart'
  | 'Bar'
  | 'BarChart'
  | 'CartesianGrid'
  | 'Cell'
  | 'ComposedChart'
  | 'Legend'
  | 'Line'
  | 'Pie'
  | 'PieChart'
  | 'ReferenceLine'
  | 'ResponsiveContainer'
  | 'Scatter'
  | 'ScatterChart'
  | 'Tooltip'
  | 'XAxis'
  | 'YAxis';

function lazyRechartsComponent(name: RechartsComponentName): ComponentType<ChartComponentProps> {
  return dynamic<ChartComponentProps>(
    async () => {
      const module = (await import('recharts')) as Record<string, unknown>;
      return module[name] as ComponentType<ChartComponentProps>;
    },
    { ssr: false }
  );
}

export const Area = lazyRechartsComponent('Area');
export const AreaChart = lazyRechartsComponent('AreaChart');
export const Bar = lazyRechartsComponent('Bar');
export const BarChart = lazyRechartsComponent('BarChart');
export const CartesianGrid = lazyRechartsComponent('CartesianGrid');
export const Cell = lazyRechartsComponent('Cell');
export const ComposedChart = lazyRechartsComponent('ComposedChart');
export const Legend = lazyRechartsComponent('Legend');
export const Line = lazyRechartsComponent('Line');
export const Pie = lazyRechartsComponent('Pie');
export const PieChart = lazyRechartsComponent('PieChart');
export const ReferenceLine = lazyRechartsComponent('ReferenceLine');
export const ResponsiveContainer = lazyRechartsComponent('ResponsiveContainer');
export const Scatter = lazyRechartsComponent('Scatter');
export const ScatterChart = lazyRechartsComponent('ScatterChart');
export const Tooltip = lazyRechartsComponent('Tooltip');
export const XAxis = lazyRechartsComponent('XAxis');
export const YAxis = lazyRechartsComponent('YAxis');
