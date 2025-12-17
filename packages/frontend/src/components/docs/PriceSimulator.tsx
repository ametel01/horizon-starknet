'use client';

import { useState } from 'react';

import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';

export function PriceSimulator(): React.ReactNode {
  const [impliedYield, setImpliedYield] = useState('10');
  const [daysToExpiry, setDaysToExpiry] = useState('180');

  const yieldNum = parseFloat(impliedYield) / 100 || 0;
  const daysNum = parseFloat(daysToExpiry) || 1;
  const yearsToExpiry = daysNum / 365;

  // Calculate PT price: 1 / (1 + yield)^time
  const ptPrice = yieldNum >= 0 ? 1 / Math.pow(1 + yieldNum, yearsToExpiry) : 0;

  // Calculate YT price
  const ytPrice = 1 - ptPrice;

  // Calculate what happens if yield changes by ±2%
  const yieldUp = yieldNum + 0.02;
  const yieldDown = Math.max(0, yieldNum - 0.02);
  const ptPriceUp = 1 / Math.pow(1 + yieldUp, yearsToExpiry);
  const ptPriceDown = 1 / Math.pow(1 + yieldDown, yearsToExpiry);

  return (
    <div className="not-prose my-6 rounded-lg border border-border bg-card p-6">
      <h3 className="text-foreground font-medium mb-4">Price Simulator</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="implied-yield">Implied Yield (%)</Label>
          <Input
            id="implied-yield"
            type="number"
            step="0.5"
            min="0"
            max="100"
            value={impliedYield}
            onChange={(e) => setImpliedYield(e.target.value)}
            className="bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="days-sim">Days to Expiry</Label>
          <Input
            id="days-sim"
            type="number"
            step="1"
            min="1"
            max="365"
            value={daysToExpiry}
            onChange={(e) => setDaysToExpiry(e.target.value)}
            className="bg-background"
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-muted p-4">
          <div className="text-sm text-muted-foreground">PT Price</div>
          <div className="text-2xl font-bold text-primary">
            {ptPrice > 0 ? ptPrice.toFixed(4) : '—'}
          </div>
        </div>

        <div className="rounded-lg bg-muted p-4">
          <div className="text-sm text-muted-foreground">YT Price</div>
          <div className="text-2xl font-bold text-foreground">
            {ytPrice > 0 ? ytPrice.toFixed(4) : '—'}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-border p-4">
        <div className="text-sm font-medium text-foreground mb-3">
          Price Sensitivity (±2% yield change)
        </div>
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              If yield ↑ to {((yieldNum + 0.02) * 100).toFixed(1)}%:
            </span>
            <span className="text-destructive font-medium">
              PT = {ptPriceUp.toFixed(4)} ({((ptPriceUp - ptPrice) / ptPrice * 100).toFixed(2)}%)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              If yield ↓ to {(yieldDown * 100).toFixed(1)}%:
            </span>
            <span className="text-primary font-medium">
              PT = {ptPriceDown.toFixed(4)} (+{((ptPriceDown - ptPrice) / ptPrice * 100).toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Formula: PT_Price = 1 / (1 + yield)^(days / 365)
      </p>
    </div>
  );
}
