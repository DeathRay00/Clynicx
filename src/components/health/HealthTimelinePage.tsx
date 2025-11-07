import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Heart, 
  Weight, 
  Thermometer,
  Moon,
  Footprints,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  BarChart3,
  LineChart,
  User,
  Clock
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useAuth } from '../../contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Progress } from '../ui/progress';
import { 
  LineChart as RechartsLineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Area,
  AreaChart,
  BarChart,
  Bar
} from 'recharts';
import { toast } from 'sonner';

interface HealthMetric {
  id: string;
  name: string;
  icon: React.ReactNode;
  unit: string;
  color: string;
  normalRange: { min: number; max: number };
  category: 'vital' | 'fitness' | 'metabolic' | 'lifestyle';
}

interface HealthData {
  date: string;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  heartRate: number;
  weight: number;
  bloodGlucose: number;
  cholesterolTotal: number;
  cholesterolLDL: number;
  cholesterolHDL: number;
  bodyTemperature: number;
  sleepHours: number;
  steps: number;
  bmi: number;
  oxygenSaturation: number;
}

// Health metrics configuration
const healthMetrics: HealthMetric[] = [
  {
    id: 'bloodPressure',
    name: 'Blood Pressure',
    icon: <Heart className="w-4 h-4" />,
    unit: 'mmHg',
    color: '#EF4444',
    normalRange: { min: 90, max: 140 },
    category: 'vital'
  },
  {
    id: 'heartRate',
    name: 'Heart Rate',
    icon: <Activity className="w-4 h-4" />,
    unit: 'bpm',
    color: '#F59E0B',
    normalRange: { min: 60, max: 100 },
    category: 'vital'
  },
  {
    id: 'weight',
    name: 'Weight',
    icon: <Weight className="w-4 h-4" />,
    unit: 'kg',
    color: '#8B5CF6',
    normalRange: { min: 50, max: 100 },
    category: 'fitness'
  },
  {
    id: 'bloodGlucose',
    name: 'Blood Glucose',
    icon: <Activity className="w-4 h-4" />,
    unit: 'mg/dL',
    color: '#10B981',
    normalRange: { min: 70, max: 140 },
    category: 'metabolic'
  },
  {
    id: 'bodyTemperature',
    name: 'Body Temperature',
    icon: <Thermometer className="w-4 h-4" />,
    unit: '°C',
    color: '#F59E0B',
    normalRange: { min: 36.1, max: 37.2 },
    category: 'vital'
  },
  {
    id: 'sleepHours',
    name: 'Sleep Duration',
    icon: <Moon className="w-4 h-4" />,
    unit: 'hours',
    color: '#6366F1',
    normalRange: { min: 7, max: 9 },
    category: 'lifestyle'
  },
  {
    id: 'steps',
    name: 'Daily Steps',
    icon: <Footprints className="w-4 h-4" />,
    unit: 'steps',
    color: '#059669',
    normalRange: { min: 8000, max: 12000 },
    category: 'fitness'
  },
  {
    id: 'bmi',
    name: 'BMI',
    icon: <BarChart3 className="w-4 h-4" />,
    unit: 'kg/m²',
    color: '#7C3AED',
    normalRange: { min: 18.5, max: 24.9 },
    category: 'fitness'
  }
];

// Mock data for the last 30 days
const generateMockData = (): HealthData[] => {
  const data: HealthData[] = [];
  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Generate realistic health data with some variation
    const baseWeight = 72;
    const weightVariation = (Math.random() - 0.5) * 4;
    const weight = baseWeight + weightVariation;
    const height = 1.75; // meters
    const bmi = weight / (height * height);
    
    data.push({
      date: date.toISOString().split('T')[0],
      bloodPressureSystolic: 115 + Math.random() * 20,
      bloodPressureDiastolic: 75 + Math.random() * 15,
      heartRate: 70 + Math.random() * 25,
      weight: weight,
      bloodGlucose: 90 + Math.random() * 30,
      cholesterolTotal: 180 + Math.random() * 40,
      cholesterolLDL: 100 + Math.random() * 30,
      cholesterolHDL: 50 + Math.random() * 20,
      bodyTemperature: 36.5 + Math.random() * 1,
      sleepHours: 6.5 + Math.random() * 3,
      steps: 6000 + Math.random() * 8000,
      bmi: bmi,
      oxygenSaturation: 95 + Math.random() * 5
    });
  }
  
  return data;
};

export const HealthTimelinePage: React.FC = () => {
  const { user } = useAuth();
  const [healthData, setHealthData] = useState<HealthData[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['heartRate', 'bloodPressure', 'weight']);
  const [dateRange, setDateRange] = useState<string>('30');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [chartType, setChartType] = useState<'line' | 'area'>('line');
  const [isLoading, setIsLoading] = useState(true);

  // Initialize data on component mount
  useEffect(() => {
    const initializeData = () => {
      try {
        const mockData = generateMockData();
        setHealthData(mockData);
        setIsLoading(false);
      } catch (error) {
        console.error('Error generating health data:', error);
        setHealthData([]);
        setIsLoading(false);
      }
    };

    initializeData();
  }, []);

  // Filter data based on date range - with safety check
  const filteredData = healthData && healthData.length > 0 
    ? healthData.slice(-parseInt(dateRange))
    : [];

  // Filter metrics based on category
  const filteredMetrics = categoryFilter === 'all' 
    ? healthMetrics 
    : healthMetrics.filter(m => m.category === categoryFilter);

  const getMetricValue = (data: HealthData | undefined, metricId: string): number => {
    if (!data) return 0;
    
    try {
      switch (metricId) {
        case 'bloodPressure':
          return data.bloodPressureSystolic || 0;
        case 'heartRate':
          return data.heartRate || 0;
        case 'weight':
          return data.weight || 0;
        case 'bloodGlucose':
          return data.bloodGlucose || 0;
        case 'bodyTemperature':
          return data.bodyTemperature || 0;
        case 'sleepHours':
          return data.sleepHours || 0;
        case 'steps':
          return data.steps || 0;
        case 'bmi':
          return data.bmi || 0;
        default:
          return 0;
      }
    } catch (error) {
      console.error('Error getting metric value:', error);
      return 0;
    }
  };

  const getMetricTrend = (metricId: string): { trend: 'up' | 'down' | 'stable'; percentage: number } => {
    if (!filteredData || filteredData.length < 2) return { trend: 'stable', percentage: 0 };
    
    try {
      const recentIndex = filteredData.length - 1;
      const previousIndex = Math.max(0, filteredData.length - 8);
      
      const recent = getMetricValue(filteredData[recentIndex], metricId);
      const previous = getMetricValue(filteredData[previousIndex], metricId);
      
      if (previous === 0) return { trend: 'stable', percentage: 0 };
      
      const change = ((recent - previous) / previous) * 100;
      
      if (Math.abs(change) < 2) return { trend: 'stable', percentage: 0 };
      return { 
        trend: change > 0 ? 'up' : 'down', 
        percentage: Math.abs(change) 
      };
    } catch (error) {
      console.error('Error calculating metric trend:', error);
      return { trend: 'stable', percentage: 0 };
    }
  };

  const isValueInNormalRange = (value: number, metricId: string): boolean => {
    const metric = healthMetrics.find(m => m.id === metricId);
    if (!metric) return true;
    return value >= metric.normalRange.min && value <= metric.normalRange.max;
  };

  const getLatestValue = (metricId: string): number => {
    if (!filteredData || filteredData.length === 0) return 0;
    try {
      return getMetricValue(filteredData[filteredData.length - 1], metricId);
    } catch (error) {
      console.error('Error getting latest value:', error);
      return 0;
    }
  };

  const handleRefreshData = () => {
    setIsLoading(true);
    setTimeout(() => {
      try {
        const newData = generateMockData();
        setHealthData(newData);
        toast.success('Health data refreshed');
      } catch (error) {
        console.error('Error refreshing data:', error);
        toast.error('Failed to refresh data');
      } finally {
        setIsLoading(false);
      }
    }, 1000);
  };

  const handleExportData = () => {
    toast.success('Health data exported successfully');
    // In real app, this would export to CSV/PDF
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatValue = (value: number, unit: string): string => {
    if (unit === 'steps') {
      return Math.round(value).toLocaleString();
    }
    return value.toFixed(1);
  };

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card p-3 shadow-lg">
          <p className="font-medium">{formatDate(label)}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {formatValue(entry.value, entry.payload.unit || '')}
              {entry.payload.unit && ` ${entry.payload.unit}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <Activity className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <p className="text-gray-600">Loading your health timeline...</p>
        </div>
      </div>
    );
  }

  // Show error state if no data
  if (!healthData || healthData.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Card className="glass-card p-8 text-center max-w-md">
          <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Health Data Available</h3>
          <p className="text-gray-600 mb-4">
            We couldn't load your health timeline data. Please try refreshing the page.
          </p>
          <Button onClick={handleRefreshData} className="glass">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Health Timeline</h1>
          <p className="text-gray-600 mt-1">
            Track your health metrics over time with detailed insights and trends
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleRefreshData}
            disabled={isLoading}
            className="glass"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExportData} className="glass">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card className="glass-card p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="vital">Vital Signs</SelectItem>
                  <SelectItem value="fitness">Fitness</SelectItem>
                  <SelectItem value="metabolic">Metabolic</SelectItem>
                  <SelectItem value="lifestyle">Lifestyle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <LineChart className="w-4 h-4 text-primary" />
              <Select value={chartType} onValueChange={(value: 'line' | 'area') => setChartType(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="line">Line Chart</SelectItem>
                  <SelectItem value="area">Area Chart</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      {/* Metrics Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredMetrics.slice(0, 8).map((metric) => {
          const latestValue = getLatestValue(metric.id);
          const trend = getMetricTrend(metric.id);
          const isNormal = isValueInNormalRange(latestValue, metric.id);
          
          return (
            <Card key={metric.id} className="glass-card p-4 hover:bg-white/20 transition-all duration-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: `${metric.color}20` }}>
                    <div style={{ color: metric.color }}>
                      {metric.icon}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{metric.name}</p>
                    <p className="text-xs text-gray-600 capitalize">{metric.category}</p>
                  </div>
                </div>
                <Badge className={isNormal ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
                  {isNormal ? 'Normal' : 'Monitor'}
                </Badge>
              </div>
              
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatValue(latestValue, metric.unit)}
                  </p>
                  <p className="text-sm text-gray-600">{metric.unit}</p>
                </div>
                
                <div className="flex items-center gap-1 text-sm">
                  {trend.trend === 'up' && <TrendingUp className="w-4 h-4 text-success" />}
                  {trend.trend === 'down' && <TrendingDown className="w-4 h-4 text-destructive" />}
                  {trend.trend !== 'stable' && (
                    <span className={trend.trend === 'up' ? 'text-success' : 'text-destructive'}>
                      {trend.percentage.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Metric Selection */}
      <Card className="glass-card p-4">
        <div className="mb-4">
          <h3 className="font-semibold text-gray-900 mb-2">Select Metrics to Display</h3>
          <div className="flex flex-wrap gap-2">
            {filteredMetrics.map((metric) => (
              <Button
                key={metric.id}
                variant={selectedMetrics.includes(metric.id) ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (selectedMetrics.includes(metric.id)) {
                    setSelectedMetrics(prev => prev.filter(id => id !== metric.id));
                  } else {
                    setSelectedMetrics(prev => [...prev, metric.id]);
                  }
                }}
                className="glass"
              >
                <div style={{ color: selectedMetrics.includes(metric.id) ? 'white' : metric.color }}>
                  {metric.icon}
                </div>
                <span className="ml-2">{metric.name}</span>
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6">
        {selectedMetrics.map((metricId) => {
          const metric = healthMetrics.find(m => m.id === metricId);
          if (!metric) return null;

          const chartData = filteredData && filteredData.length > 0 
            ? filteredData.map(data => ({
                date: data?.date || '',
                value: getMetricValue(data, metricId),
                formattedDate: data?.date ? formatDate(data.date) : ''
              })).filter(item => item.date && item.formattedDate)
            : [];

          return (
            <Card key={metricId} className="glass-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: `${metric.color}20` }}>
                    <div style={{ color: metric.color }}>
                      {metric.icon}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{metric.name}</h3>
                    <p className="text-sm text-gray-600">
                      Normal range: {metric.normalRange.min} - {metric.normalRange.max} {metric.unit}
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-sm text-gray-600">Latest Value</p>
                  <p className="text-xl font-bold" style={{ color: metric.color }}>
                    {formatValue(getLatestValue(metricId), metric.unit)} {metric.unit}
                  </p>
                </div>
              </div>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'area' ? (
                    <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                      <XAxis 
                        dataKey="formattedDate" 
                        stroke="#6B7280"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="#6B7280"
                        fontSize={12}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={metric.color}
                        fill={`${metric.color}30`}
                        strokeWidth={2}
                        name={metric.name}
                      />
                      {/* Normal range indicators */}
                      <Area
                        type="monotone"
                        dataKey={() => metric.normalRange.max}
                        stroke="rgba(16, 185, 129, 0.3)"
                        fill="none"
                        strokeDasharray="5 5"
                      />
                      <Area
                        type="monotone"
                        dataKey={() => metric.normalRange.min}
                        stroke="rgba(16, 185, 129, 0.3)"
                        fill="none"
                        strokeDasharray="5 5"
                      />
                    </AreaChart>
                  ) : (
                    <RechartsLineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                      <XAxis 
                        dataKey="formattedDate" 
                        stroke="#6B7280"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="#6B7280"
                        fontSize={12}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={metric.color}
                        strokeWidth={3}
                        dot={{ r: 4, fill: metric.color }}
                        activeDot={{ r: 6, fill: metric.color }}
                        name={metric.name}
                      />
                      {/* Normal range indicators */}
                      <Line
                        type="monotone"
                        dataKey={() => metric.normalRange.max}
                        stroke="rgba(16, 185, 129, 0.5)"
                        strokeDasharray="5 5"
                        dot={false}
                        name="Upper Normal"
                      />
                      <Line
                        type="monotone"
                        dataKey={() => metric.normalRange.min}
                        stroke="rgba(16, 185, 129, 0.5)"
                        strokeDasharray="5 5"
                        dot={false}
                        name="Lower Normal"
                      />
                    </RechartsLineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Summary Insights */}
      <Card className="glass-card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Health Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-success/10 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-success" />
              <span className="font-medium text-success">Improving Trends</span>
            </div>
            <p className="text-sm text-gray-700">
              Your sleep duration and step count have shown consistent improvement over the past week.
            </p>
          </div>
          
          <div className="p-4 bg-warning/10 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-warning" />
              <span className="font-medium text-warning">Areas to Monitor</span>
            </div>
            <p className="text-sm text-gray-700">
              Blood pressure readings have been slightly elevated. Consider discussing with your healthcare provider.
            </p>
          </div>
          
          <div className="p-4 bg-primary/10 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-primary" />
              <span className="font-medium text-primary">Overall Health</span>
            </div>
            <p className="text-sm text-gray-700">
              Most of your health metrics are within normal ranges. Keep up the good work!
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};