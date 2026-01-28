"use client";
import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi } from 'lightweight-charts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUpIcon, ArrowDownIcon, TrendingUpIcon, TrendingDownIcon } from 'lucide-react';

interface Indicators {
  rsi: number;
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  movingAverages: {
    ma20: number;
    ma50: number;
    ma200: number;
  };
}

interface TechnicalAnalysisProps {
  asset: {
    id: string;
    name: string;
  };
}

export default function TechnicalAnalysis({ asset }: TechnicalAnalysisProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [chartData, setChartData] = useState<{ time: number; value: number }[]>([]);
  const chartRef = useRef<IChartApi | null>(null);
  const [selectedIndicator, setSelectedIndicator] = useState<'all' | 'rsi' | 'macd' | 'bb'>('all');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/crypto/analysis/${asset.id}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch analysis data');
        }
        
        const data = await response.json();
        if (!data.prices || !data.indicators) {
          throw new Error('Invalid data format received from server');
        }

        setChartData(data.prices);
        setIndicators(data.indicators);
      } catch (error) {
        console.error('Error fetching technical data:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch analysis data');
        // Clear previous data on error
        setChartData([]);
        setIndicators(null);
      } finally {
        setLoading(false);
      }
    };

    if (asset?.id) {
      fetchData();
    }
  }, [asset]);

  useEffect(() => {
    if (!chartContainerRef.current || !chartData || chartData.length === 0) {
      // Clear chart if no data
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      return;
    }

    // Clear previous chart if any
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }
    chartContainerRef.current.innerHTML = '';

    try {
      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: 'rgb(15 23 42 / 0.8)',
        },
        grid: {
          vertLines: { color: 'rgb(226 232 240)' },
          horzLines: { color: 'rgb(226 232 240)' },
        },
        width: chartContainerRef.current.clientWidth,
        height: 300,
        timeScale: {
          timeVisible: true,
          borderColor: 'rgb(226 232 240)',
        },
        // @ts-ignore - Compatibility with current library version
        rightPriceScale: {
          borderColor: 'rgb(226 232 240)',
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
        crosshair: {
          mode: 'Normal',
          vertLine: {
            width: 1,
            color: 'rgb(148 163 184)',
            style: 0,
          },
          horzLine: {
            width: 1,
            color: 'rgb(148 163 184)',
            style: 0,
            labelBackgroundColor: 'rgb(248 250 252)',
          },
        },
        handleScroll: {
          vertTouchDrag: true,
        },
      });

      chartRef.current = chart;

      const mainSeries = chart.addLineSeries({
        color: 'rgb(37 99 235 / 0.7)',
        lineWidth: 2,
        // @ts-ignore - Compatibility with current library version
        priceLineVisible: false,
      });

      mainSeries.setData(chartData);

      // Show different indicators based on selection
      if (indicators) {
        if (selectedIndicator === 'all' || selectedIndicator === 'bb') {
          // Add Bollinger Bands
          const bbUpper = chart.addLineSeries({
            color: 'rgba(33, 150, 243, 0.6)',
            lineWidth: 1,
            // @ts-ignore - Compatibility with current library version
            lineStyle: 2,
          });

          const bbLower = chart.addLineSeries({
            color: 'rgba(255, 82, 82, 0.6)',
            lineWidth: 1,
            // @ts-ignore - Compatibility with current library version
            lineStyle: 2,
          });

          const bbData = chartData.map((item) => ({
            time: item.time,
            value: indicators.bollingerBands.upper
          }));

          const bbLowerData = chartData.map((item) => ({
            time: item.time,
            value: indicators.bollingerBands.lower
          }));

          bbUpper.setData(bbData);
          bbLower.setData(bbLowerData);
        }

        if (selectedIndicator === 'all' || selectedIndicator === 'rsi') {
          // Add Moving Averages
          const ma20 = chart.addLineSeries({
            color: 'rgba(255, 235, 59, 0.8)',
            lineWidth: 1,
          });
          
          const ma50 = chart.addLineSeries({
            color: 'rgba(233, 30, 99, 0.8)',
            lineWidth: 1,
          });
          
          const ma200 = chart.addLineSeries({
            color: 'rgba(0, 188, 212, 0.8)',
            lineWidth: 1.5,
            // @ts-ignore - Compatibility with current library version
            lineStyle: 2,
          });
          
          const ma20Data = chartData.map((item) => ({
            time: item.time,
            value: indicators.movingAverages.ma20
          }));
          
          const ma50Data = chartData.map((item) => ({
            time: item.time,
            value: indicators.movingAverages.ma50
          }));
          
          const ma200Data = chartData.map((item) => ({
            time: item.time,
            value: indicators.movingAverages.ma200
          }));
          
          ma20.setData(ma20Data);
          ma50.setData(ma50Data);
          ma200.setData(ma200Data);
        }

        if (selectedIndicator === 'all' || selectedIndicator === 'macd') {
          // Add MACD
          const macdLine = chart.addLineSeries({
            color: 'rgba(76, 175, 80, 0.8)',
            lineWidth: 1,
            // @ts-ignore - Compatibility with current library version
            lineStyle: 0,
          });
          
          const signalLine = chart.addLineSeries({
            color: 'rgba(255, 82, 82, 0.8)',
            lineWidth: 1,
            // @ts-ignore - Compatibility with current library version
            lineStyle: 0,
          });

          const macdData = chartData.map((item) => ({
            time: item.time,
            value: indicators.macd.macdLine
          }));

          const signalData = chartData.map((item) => ({
            time: item.time,
            value: indicators.macd.signalLine
          }));

          macdLine.setData(macdData);
          signalLine.setData(signalData);
        }
      }

      // Fit content and handle resize
      // @ts-ignore - Compatibility with current library version
      chart.timeScale().fitContent();
      
      const handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth
          });
        }
      };

      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
      };
    } catch (error) {
      console.error('Error creating chart:', error);
    }
  }, [chartData, indicators, selectedIndicator]);

  // Function to determine signal strength
  const getSignalStrength = (value: number, type: 'rsi' | 'macd'): { strength: 'strong' | 'moderate' | 'neutral' | 'weak'; bullish: boolean } => {
    if (type === 'rsi') {
      if (value > 70) return { strength: 'strong', bullish: false };
      if (value < 30) return { strength: 'strong', bullish: true };
      if (value > 60) return { strength: 'moderate', bullish: false };
      if (value < 40) return { strength: 'moderate', bullish: true };
      return { strength: 'neutral', bullish: value >= 50 };
    } else { // MACD
      const absValue = Math.abs(value);
      if (absValue > 1) return { strength: 'strong', bullish: value > 0 };
      if (absValue > 0.5) return { strength: 'moderate', bullish: value > 0 };
      if (absValue > 0.2) return { strength: 'weak', bullish: value > 0 };
      return { strength: 'neutral', bullish: value >= 0 };
    }
  };

  // Get signal strength classes
  const getSignalClasses = (strength: 'strong' | 'moderate' | 'neutral' | 'weak', bullish: boolean) => {
    const baseClasses = "rounded-full px-2 py-0.5 text-xs font-medium flex items-center gap-1 ";
    
    if (strength === 'strong') {
      return bullish 
        ? baseClasses + "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
        : baseClasses + "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    }
    
    if (strength === 'moderate') {
      return bullish 
        ? baseClasses + "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
        : baseClasses + "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    }
    
    if (strength === 'weak') {
      return bullish 
        ? baseClasses + "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
        : baseClasses + "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    }
    
    return baseClasses + "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
  };

  return (
    <div className="flex flex-col gap-2 h-[400px] max-h-[400px]">
      <ScrollArea className="flex-1 overflow-auto">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="text-sm font-medium">{asset.name} Analysis</div>
          <div className="flex gap-1">
            <Badge 
              variant={selectedIndicator === 'all' ? "default" : "outline"} 
              className="cursor-pointer hover:bg-primary/20"
              onClick={() => setSelectedIndicator('all')}
            >
              All
            </Badge>
            <Badge 
              variant={selectedIndicator === 'rsi' ? "default" : "outline"} 
              className="cursor-pointer hover:bg-primary/20"
              onClick={() => setSelectedIndicator('rsi')}
            >
              RSI/MA
            </Badge>
            <Badge 
              variant={selectedIndicator === 'bb' ? "default" : "outline"} 
              className="cursor-pointer hover:bg-primary/20"
              onClick={() => setSelectedIndicator('bb')}
            >
              Bollinger
            </Badge>
            <Badge 
              variant={selectedIndicator === 'macd' ? "default" : "outline"} 
              className="cursor-pointer hover:bg-primary/20"
              onClick={() => setSelectedIndicator('macd')}
            >
              MACD
            </Badge>
          </div>
        </div>
        
        <div className="relative h-[300px]" ref={chartContainerRef} />
        
        {loading ? (
          <div className="flex items-center justify-center h-[100px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-[100px] text-destructive">
            <div className="text-center">
              <p className="font-medium">Error loading technical analysis</p>
              <p className="text-sm mt-2">{error}</p>
            </div>
          </div>
        ) : indicators ? (
          <div className="mt-2">
            <Tabs defaultValue="signals" className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-8">
                <TabsTrigger value="signals" className="text-xs">Signals</TabsTrigger>
                <TabsTrigger value="indicators" className="text-xs">Indicators</TabsTrigger>
                <TabsTrigger value="levels" className="text-xs">Key Levels</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signals" className="mt-2">
                <div className="grid grid-cols-2 gap-3">
                  {/* RSI Signal */}
                  <Card className="border-0 shadow-sm bg-card/50">
                    <CardHeader className="p-3 pb-0">
                      <CardTitle className="text-xs font-medium">RSI Signal</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-1">
                      {(() => {
                        const rsiSignal = getSignalStrength(indicators.rsi, 'rsi');
                        return (
                          <div className="flex flex-col gap-1">
                            <div className={getSignalClasses(rsiSignal.strength, rsiSignal.bullish)}>
                              {rsiSignal.bullish ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />}
                              {rsiSignal.strength === 'strong' ? 'Strong' : 
                               rsiSignal.strength === 'moderate' ? 'Moderate' : 
                               rsiSignal.strength === 'weak' ? 'Weak' : 'Neutral'}
                              {rsiSignal.bullish ? ' Bullish' : ' Bearish'}
                            </div>
                            <div className="text-xs mt-1">
                              Current: <span className="font-medium">{indicators.rsi.toFixed(2)}</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full mt-1">
                              <div 
                                className={`h-1.5 rounded-full ${
                                  indicators.rsi > 70 ? 'bg-red-500' : 
                                  indicators.rsi < 30 ? 'bg-green-500' : 
                                  indicators.rsi > 50 ? 'bg-yellow-500' : 'bg-blue-500'
                                }`}
                                style={{ width: `${indicators.rsi}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                              <span>Oversold</span>
                              <span>Neutral</span>
                              <span>Overbought</span>
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                  
                  {/* MACD Signal */}
                  <Card className="border-0 shadow-sm bg-card/50">
                    <CardHeader className="p-3 pb-0">
                      <CardTitle className="text-xs font-medium">MACD Signal</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-1">
                      {(() => {
                        const macdSignal = getSignalStrength(indicators.macd.histogram, 'macd');
                        return (
                          <div className="flex flex-col gap-1">
                            <div className={getSignalClasses(macdSignal.strength, macdSignal.bullish)}>
                              {macdSignal.bullish ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />}
                              {macdSignal.strength === 'strong' ? 'Strong' : 
                               macdSignal.strength === 'moderate' ? 'Moderate' : 
                               macdSignal.strength === 'weak' ? 'Weak' : 'Neutral'}
                              {macdSignal.bullish ? ' Bullish' : ' Bearish'}
                            </div>
                            <div className="grid grid-cols-2 gap-x-2 text-xs mt-1">
                              <div>MACD: <span className="font-medium">{indicators.macd.macdLine.toFixed(2)}</span></div>
                              <div>Signal: <span className="font-medium">{indicators.macd.signalLine.toFixed(2)}</span></div>
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              <div className="text-xs">Histogram:</div>
                              <div className={`text-xs font-medium ${
                                indicators.macd.histogram > 0 ? 'text-green-500' : 'text-red-500'
                              }`}>
                                {indicators.macd.histogram.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="indicators" className="mt-2">
                <div className="grid grid-cols-2 gap-3">
                  {/* Moving Averages */}
                  <Card className="border-0 shadow-sm bg-card/50">
                    <CardHeader className="p-3 pb-0">
                      <CardTitle className="text-xs font-medium">Moving Averages</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-1">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full bg-[rgba(255,235,59,0.8)] mr-1"></div>
                            <span className="text-xs">MA20</span>
                          </div>
                          <span className="text-xs font-medium">{indicators.movingAverages.ma20.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full bg-[rgba(233,30,99,0.8)] mr-1"></div>
                            <span className="text-xs">MA50</span>
                          </div>
                          <span className="text-xs font-medium">{indicators.movingAverages.ma50.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full bg-[rgba(0,188,212,0.8)] mr-1"></div>
                            <span className="text-xs">MA200</span>
                          </div>
                          <span className="text-xs font-medium">{indicators.movingAverages.ma200.toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Bollinger Bands */}
                  <Card className="border-0 shadow-sm bg-card/50">
                    <CardHeader className="p-3 pb-0">
                      <CardTitle className="text-xs font-medium">Bollinger Bands</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-1">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full bg-[rgba(76,175,80,0.6)] mr-1"></div>
                            <span className="text-xs">Upper</span>
                          </div>
                          <span className="text-xs font-medium">{indicators.bollingerBands.upper.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full bg-white/60 mr-1"></div>
                            <span className="text-xs">Middle</span>
                          </div>
                          <span className="text-xs font-medium">{indicators.bollingerBands.middle.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full bg-[rgba(255,82,82,0.6)] mr-1"></div>
                            <span className="text-xs">Lower</span>
                          </div>
                          <span className="text-xs font-medium">{indicators.bollingerBands.lower.toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="levels" className="mt-2">
                <Card className="border-0 shadow-sm bg-card/50">
                  <CardContent className="p-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <h4 className="text-xs font-medium mb-2">Support Levels</h4>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-xs">Strong</span>
                            <span className="text-xs font-medium">${(indicators.bollingerBands.lower * 0.98).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs">Moderate</span>
                            <span className="text-xs font-medium">${indicators.bollingerBands.lower.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs">Weak</span>
                            <span className="text-xs font-medium">${indicators.movingAverages.ma50.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-medium mb-2">Resistance Levels</h4>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-xs">Weak</span>
                            <span className="text-xs font-medium">${indicators.movingAverages.ma20.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs">Moderate</span>
                            <span className="text-xs font-medium">${indicators.bollingerBands.upper.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs">Strong</span>
                            <span className="text-xs font-medium">${(indicators.bollingerBands.upper * 1.02).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </ScrollArea>
    </div>
  );
}