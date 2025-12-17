'use client';

import { useState } from 'react';

import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';

export function YieldCalculator(): React.ReactNode {
  const [ptPrice, setPtPrice] = useState('0.95');
  const [daysToExpiry, setDaysToExpiry] = useState('180');

  const ptPriceNum = parseFloat(ptPrice) || 0;
  const daysNum = parseFloat(daysToExpiry) || 1;

  // Calculate implied APY: (1 / PT_Price)^(365 / days) - 1
  const impliedApy =
    ptPriceNum > 0 && ptPriceNum < 1
      ? (Math.pow(1 / ptPriceNum, 365 / daysNum) - 1) * 100
      : 0;

  // Calculate YT price
  const ytPrice = ptPriceNum > 0 && ptPriceNum < 1 ? 1 - ptPriceNum : 0;

  return (
    <div className="not-prose my-6 rounded-lg border border-border bg-card p-6">
      <h3 className="text-foreground font-medium mb-4">Yield Calculator</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pt-price">PT Price (SY)</Label>
          <Input
            id="pt-price"
            type="number"
            step="0.01"
            min="0.01"
            max="0.99"
            value={ptPrice}
            onChange={(e) => setPtPrice(e.target.value)}
            className="bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="days-expiry">Days to Expiry</Label>
          <Input
            id="days-expiry"
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

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-muted p-4">
          <div className="text-sm text-muted-foreground">Implied APY</div>
          <div className="text-2xl font-bold text-primary">
            {impliedApy > 0 ? `${impliedApy.toFixed(2)}%` : '—'}
          </div>
        </div>

        <div className="rounded-lg bg-muted p-4">
          <div className="text-sm text-muted-foreground">YT Price</div>
          <div className="text-2xl font-bold text-foreground">
            {ytPrice > 0 ? ytPrice.toFixed(4) : '—'}
          </div>
        </div>

        <div className="rounded-lg bg-muted p-4">
          <div className="text-sm text-muted-foreground">PT Discount</div>
          <div className="text-2xl font-bold text-foreground">
            {ptPriceNum > 0 && ptPriceNum < 1
              ? `${((1 - ptPriceNum) * 100).toFixed(2)}%`
              : '—'}
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Formula: Implied APY = (1 / PT_Price)^(365 / days) - 1
      </p>
    </div>
  );
}
