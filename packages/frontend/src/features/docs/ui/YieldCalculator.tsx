'use client';

import { useState } from 'react';

import { Input } from '@shared/ui/Input';
import { Label } from '@shared/ui/label';

export function YieldCalculator(): React.ReactNode {
  const [ptPrice, setPtPrice] = useState('0.95');
  const [daysToExpiry, setDaysToExpiry] = useState('180');

  const ptPriceNum = parseFloat(ptPrice) || 0;
  const daysNum = parseFloat(daysToExpiry) || 1;

  // Calculate implied APY: (1 / PT_Price)^(365 / days) - 1
  const impliedApy =
    ptPriceNum > 0 && ptPriceNum < 1 ? (Math.pow(1 / ptPriceNum, 365 / daysNum) - 1) * 100 : 0;

  // Calculate YT price
  const ytPrice = ptPriceNum > 0 && ptPriceNum < 1 ? 1 - ptPriceNum : 0;

  return (
    <div className="not-prose border-border bg-card my-6 rounded-lg border p-6">
      <h3 className="text-foreground mb-4 font-medium">Yield Calculator</h3>

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
            onChange={(e) => {
              setPtPrice(e.target.value);
            }}
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
            onChange={(e) => {
              setDaysToExpiry(e.target.value);
            }}
            className="bg-background"
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="bg-muted rounded-lg p-4">
          <div className="text-muted-foreground text-sm">Implied APY</div>
          <div className="text-primary text-2xl font-bold">
            {impliedApy > 0 ? `${impliedApy.toFixed(2)}%` : '—'}
          </div>
        </div>

        <div className="bg-muted rounded-lg p-4">
          <div className="text-muted-foreground text-sm">YT Price</div>
          <div className="text-foreground text-2xl font-bold">
            {ytPrice > 0 ? ytPrice.toFixed(4) : '—'}
          </div>
        </div>

        <div className="bg-muted rounded-lg p-4">
          <div className="text-muted-foreground text-sm">PT Discount</div>
          <div className="text-foreground text-2xl font-bold">
            {ptPriceNum > 0 && ptPriceNum < 1 ? `${((1 - ptPriceNum) * 100).toFixed(2)}%` : '—'}
          </div>
        </div>
      </div>

      <p className="text-muted-foreground mt-4 text-xs">
        Formula: Implied APY = (1 / PT_Price)^(365 / days) - 1
      </p>
    </div>
  );
}
