"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CryptoAsset } from '../types/market';
import { ArrowUpIcon, ArrowDownIcon, BarChart3Icon, DollarSignIcon, HistoryIcon } from 'lucide-react';

interface TradingSimulatorProps {
  asset: CryptoAsset;
}

interface Position {
  id: string;
  asset: CryptoAsset;
  quantity: number;
  entryPrice: number;
  timestamp: number;
  type: 'long' | 'short';
}

interface TradeHistory {
  id: string;
  asset: CryptoAsset;
  quantity: number;
  price: number;
  timestamp: number;
  action: 'buy' | 'sell';
  profitLoss?: number;
}

export default function TradingSimulator({ asset }: TradingSimulatorProps) {
  // State for virtual balance and positions
  const [virtualBalance, setVirtualBalance] = useState<number>(10000); // Start with $10,000
  const [positions, setPositions] = useState<Position[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistory[]>([]);
  
  // Trading form state
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [orderAction, setOrderAction] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState<number>(0);
  const [limitPrice, setLimitPrice] = useState<number>(asset?.current_price || 0);
  const [positionType, setPositionType] = useState<'long' | 'short'>('long');
  
  // Update limit price when asset changes
  useEffect(() => {
    if (asset) {
      setLimitPrice(asset.current_price);
    }
  }, [asset]);
  
  // Calculate total position value
  const calculatePositionValue = () => {
    return positions.reduce((total, position) => {
      const currentValue = position.quantity * asset.current_price;
      return total + currentValue;
    }, 0);
  };
  
  // Calculate total profit/loss
  const calculateTotalProfitLoss = () => {
    return positions.reduce((total, position) => {
      const currentValue = position.quantity * asset.current_price;
      const initialValue = position.quantity * position.entryPrice;
      const profitLoss = position.type === 'long' 
        ? currentValue - initialValue
        : initialValue - currentValue;
      return total + profitLoss;
    }, 0);
  };
  
  // Execute a trade
  const executeTrade = () => {
    if (!asset || quantity <= 0) return;
    
    const tradePrice = orderType === 'market' ? asset.current_price : limitPrice;
    const tradeValue = quantity * tradePrice;
    
    // Generate a unique ID for the trade
    const tradeId = `trade-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    if (orderAction === 'buy') {
      // Check if user has enough balance
      if (tradeValue > virtualBalance) {
        alert('Insufficient funds for this trade');
        return;
      }
      
      // Create new position
      const newPosition: Position = {
        id: tradeId,
        asset,
        quantity,
        entryPrice: tradePrice,
        timestamp: Date.now(),
        type: positionType
      };
      
      // Update positions and balance
      setPositions([...positions, newPosition]);
      setVirtualBalance(prevBalance => prevBalance - tradeValue);
      
      // Add to trade history
      const newTrade: TradeHistory = {
        id: tradeId,
        asset,
        quantity,
        price: tradePrice,
        timestamp: Date.now(),
        action: 'buy'
      };
      
      setTradeHistory([newTrade, ...tradeHistory]);
    } else {
      // Selling logic
      // Find positions to sell
      const remainingPositions = [...positions];
      let quantityToSell = quantity;
      let totalSaleValue = 0;
      let totalProfitLoss = 0;
      
      // Create a copy of positions that we'll modify
      const updatedPositions = [];
      const soldTrades = [];
      
      for (let i = 0; i < remainingPositions.length; i++) {
        const position = remainingPositions[i];
        
        if (quantityToSell <= 0) {
          // We've sold all we needed to, keep the rest of the positions
          updatedPositions.push(position);
          continue;
        }
        
        if (position.quantity <= quantityToSell) {
          // Sell the entire position
          quantityToSell -= position.quantity;
          
          const saleValue = position.quantity * tradePrice;
          totalSaleValue += saleValue;
          
          const positionValue = position.quantity * position.entryPrice;
          const profitLoss = position.type === 'long'
            ? saleValue - positionValue
            : positionValue - saleValue;
          
          totalProfitLoss += profitLoss;
          
          // Add to trade history
          soldTrades.push({
            id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            asset,
            quantity: position.quantity,
            price: tradePrice,
            timestamp: Date.now(),
            action: 'sell' as 'buy' | 'sell',
            profitLoss
          });
        } else {
          // Sell part of the position
          const saleValue = quantityToSell * tradePrice;
          totalSaleValue += saleValue;
          
          const positionValue = quantityToSell * position.entryPrice;
          const profitLoss = position.type === 'long'
            ? saleValue - positionValue
            : positionValue - saleValue;
          
          totalProfitLoss += profitLoss;
          
          // Add to trade history
          soldTrades.push({
            id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            asset,
            quantity: quantityToSell,
            price: tradePrice,
            timestamp: Date.now(),
            action: 'sell' as 'buy' | 'sell',
            profitLoss
          });
          
          // Update the position with remaining quantity
          updatedPositions.push({
            ...position,
            quantity: position.quantity - quantityToSell
          });
          
          quantityToSell = 0;
        }
      }
      
      // Check if we could sell all the requested quantity
      if (quantityToSell > 0) {
        alert(`You only have ${quantity - quantityToSell} ${asset.symbol.toUpperCase()} available to sell`);
        return;
      }
      
      // Update positions, balance and trade history
      setPositions(updatedPositions);
      setVirtualBalance(prevBalance => prevBalance + totalSaleValue);
      setTradeHistory([...soldTrades, ...tradeHistory]);
    }
    
    // Reset form
    setQuantity(0);
  };
  
  // Calculate maximum quantity user can buy with current balance
  const calculateMaxBuy = () => {
    if (!asset || asset.current_price === 0) return 0;
    return Math.floor((virtualBalance / asset.current_price) * 100) / 100;
  };
  
  // Calculate maximum quantity user can sell from their positions
  const calculateMaxSell = () => {
    return positions.reduce((total, position) => {
      if (position.asset.id === asset.id) {
        return total + position.quantity;
      }
      return total;
    }, 0);
  };
  
  // Set maximum quantity based on action
  const setMaxQuantity = () => {
    if (orderAction === 'buy') {
      setQuantity(calculateMaxBuy());
    } else {
      setQuantity(calculateMaxSell());
    }
  };
  
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };
  
  // Format percentage
  const formatPercentage = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value / 100);
  };
  
  // Reset simulator
  const resetSimulator = () => {
    if (confirm('Are you sure you want to reset the simulator? This will clear all positions and reset your balance.')) {
      setVirtualBalance(10000);
      setPositions([]);
      setTradeHistory([]);
    }
  };
  
  return (
    <div className="h-[400px] max-h-[400px] flex flex-col">
      <ScrollArea className="flex-1 overflow-auto">
        <div className="space-y-6 p-1">
          {/* Account Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="text-sm font-medium">Virtual Balance</div>
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold truncate max-w-[70%]" title={formatCurrency(virtualBalance)}>{formatCurrency(virtualBalance)}</div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex items-center justify-center h-8 w-8 p-0 flex-shrink-0" 
                    onClick={() => setVirtualBalance(prevBalance => prevBalance + 1000)}
                  >
                    <span className="text-lg">+</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="text-sm font-medium">Position Value</div>
                <div className="text-2xl font-bold">{formatCurrency(calculatePositionValue())}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="text-sm font-medium">Profit/Loss</div>
                <div className={`text-2xl font-bold ${calculateTotalProfitLoss() >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatCurrency(calculateTotalProfitLoss())}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Trading Interface */}
          <Tabs defaultValue="trade" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="trade">Trade</TabsTrigger>
              <TabsTrigger value="positions">Positions</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            
            {/* Trading Form */}
            <TabsContent value="trade" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Order Type</label>
                  <Select value={orderType} onValueChange={(value) => setOrderType(value as 'market' | 'limit')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Order Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="market">Market</SelectItem>
                      <SelectItem value="limit">Limit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Action</label>
                  <Select value={orderAction} onValueChange={(value) => setOrderAction(value as 'buy' | 'sell')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buy">Buy</SelectItem>
                      <SelectItem value="sell">Sell</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {orderAction === 'buy' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Position Type</label>
                  <Select value={positionType} onValueChange={(value) => setPositionType(value as 'long' | 'short')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Position Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="long">Long</SelectItem>
                      <SelectItem value="short">Short</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {orderType === 'limit' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Limit Price</label>
                  <Input 
                    type="number" 
                    value={limitPrice} 
                    onChange={(e) => setLimitPrice(parseFloat(e.target.value))} 
                    min={0} 
                    step={0.01} 
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-sm font-medium">Quantity</label>
                  <Button variant="link" size="sm" className="h-5 p-0" onClick={setMaxQuantity}>
                    Max
                  </Button>
                </div>
                <Input 
                  type="number" 
                  value={quantity} 
                  onChange={(e) => setQuantity(parseFloat(e.target.value))} 
                  min={0} 
                  step={0.01} 
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Total Value</label>
                <div className="text-lg font-bold">
                  {formatCurrency(quantity * (orderType === 'market' ? asset?.current_price || 0 : limitPrice))}
                </div>
              </div>
              
              <Button 
                className={`w-full ${orderAction === 'buy' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
                onClick={executeTrade}
                disabled={!asset || quantity <= 0}
              >
                {orderAction === 'buy' ? 'Buy' : 'Sell'} {asset?.symbol.toUpperCase()}
              </Button>
            </TabsContent>
            
            {/* Positions Tab */}
            <TabsContent value="positions">
              {positions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No open positions. Start trading to see your positions here.
                </div>
              ) : (
                <div className="space-y-4">
                  {positions.map((position) => {
                    const currentValue = position.quantity * asset.current_price;
                    const initialValue = position.quantity * position.entryPrice;
                    const profitLoss = position.type === 'long' 
                      ? currentValue - initialValue 
                      : initialValue - currentValue;
                    const profitLossPercentage = (profitLoss / initialValue) * 100;
                    
                    return (
                      <Card key={position.id} className="bg-card/50">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge className={position.type === 'long' ? 'bg-blue-500/10 text-blue-600' : 'bg-slate-500/10 text-slate-600'}>
                                  {position.type.toUpperCase()}
                                </Badge>
                                <span className="font-medium">{position.asset.symbol.toUpperCase()}</span>
                              </div>
                              <div className="text-sm">
                                <span className="text-muted-foreground">Quantity:</span> {position.quantity}
                              </div>
                              <div className="text-sm">
                                <span className="text-muted-foreground">Entry Price:</span> {formatCurrency(position.entryPrice)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm">Current Value</div>
                              <div className="font-bold">{formatCurrency(currentValue)}</div>
                              <div className={`text-sm ${profitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {profitLoss >= 0 ? '+' : ''}{formatCurrency(profitLoss)} ({profitLossPercentage >= 0 ? '+' : ''}{formatPercentage(profitLossPercentage)})
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
            
            {/* History Tab */}
            <TabsContent value="history">
              {tradeHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No trade history. Start trading to see your history here.
                </div>
              ) : (
                <div className="space-y-4">
                  {tradeHistory.map((trade) => (
                    <Card key={trade.id} className="bg-card/50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge className={trade.action === 'buy' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}>
                                {trade.action.toUpperCase()}
                              </Badge>
                              <span className="font-medium">{trade.asset.symbol.toUpperCase()}</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">Quantity:</span> {trade.quantity}
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">Price:</span> {formatCurrency(trade.price)}
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">Date:</span> {new Date(trade.timestamp).toLocaleString()}
                            </div>
                          </div>
                          {trade.action === 'sell' && trade.profitLoss !== undefined && (
                            <div className="text-right">
                              <div className="text-sm">Profit/Loss</div>
                              <div className={`font-bold ${trade.profitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {trade.profitLoss >= 0 ? '+' : ''}{formatCurrency(trade.profitLoss)}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
          
          {/* Reset Button */}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={resetSimulator}>
              Reset Simulator
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}