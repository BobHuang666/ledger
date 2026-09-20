import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { getAnalyticsOverview, getStats, type AnalyticsOverview } from '../api/api';

interface SankeyTooltipParams {
  dataType?: string;
  name?: string;
  data?: {
    origin?: string;
    address?: string;
    value?: number;
    raw?: string;
  };
}

type KPIData = {
  totalRecords: number;
  originCategories: number;
  diseaseCategories: number;
  cemeteryCategories: number;
};

const VisualizationPage = () => {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [kpi, setKpi] = useState<KPIData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [
          analyticsResult,
          originStats,
          diseaseStats,
          cemeteryStats,
        ] = await Promise.all([
          getAnalyticsOverview(),
          getStats(['籍贯']),
          getStats(['病状']),
          getStats(['墓地陇名']),
        ]);
        if (analyticsResult.error) {
          setError(analyticsResult.error);
        } else {
          setData(analyticsResult);
          setKpi({
            totalRecords: analyticsResult.total,
            originCategories: originStats.total,
            diseaseCategories: diseaseStats.total,
            cemeteryCategories: cemeteryStats.total,
          });
          // 设置默认选中的年份（第一个有数据的年份）
          if (analyticsResult.deathDate && Object.keys(analyticsResult.deathDate).length > 0) {
            const firstYear = Object.keys(analyticsResult.deathDate).sort()[0];
            setSelectedYear(firstYear);
          }
        }
      } catch {
        setError('加载数据失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 通用图表配置
  const commonOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(31, 107, 255, 0.2)',
      borderWidth: 1,
      textStyle: {
        color: '#1f2937',
      },
      formatter: '{b}: {c} ({d}%)',
    },
    textStyle: {
      fontFamily: "'Inter', 'Noto Sans SC', sans-serif",
    },
  };

  const sankeyColors = {
    origin: '#1f6bff',
    address: '#34d399',
  };

  const formatSankeyTooltip = (params: SankeyTooltipParams): string => {
    if (params.dataType === 'edge' && params.data) {
      const { origin = '', address = '', value = 0 } = params.data;
      return `${origin} → ${address}<br />人数：${value}`;
    }
    const label = params.data?.raw || params.name || '';
    return `${label}`;
  };

  // 柱状图配置
  const barOption = {
    ...commonOption,
    tooltip: {
      ...commonOption.tooltip,
      trigger: 'axis',
      formatter: '{b}: {c}',
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
      top: '10%',
    },
    xAxis: {
      type: 'category',
      axisLabel: {
        rotate: 45,
        interval: 0,
      },
    },
    yAxis: {
      type: 'value',
    },
  };

  // 折线图配置
  const lineOption = {
    ...commonOption,
    tooltip: {
      ...commonOption.tooltip,
      trigger: 'axis',
      formatter: '{b}: {c}',
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
      top: '10%',
    },
    xAxis: {
      type: 'category',
      axisLabel: {
        rotate: 45,
        interval: 0,
      },
    },
    yAxis: {
      type: 'value',
    },
  };

  // 饼图配置
  const pieOption = {
    ...commonOption,
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
    },
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="card soft" style={{ textAlign: 'center', padding: '48px' }}>
          <p className="page-description">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !data || !kpi) {
    return (
      <div className="page-container">
        <div className="alert alert-error" role="alert">
          <span>{error || '数据加载失败，请稍后重试'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="stats-header">
        <div className="stats-header-content">
          <h2 className="page-heading">数据可视化分析</h2>
        </div>
      </div>

      {/* KPI 卡片 */}
      <div className="kpi-grid">
        <div className="card soft kpi-card">
          <div className="kpi-value">
            {kpi.totalRecords.toLocaleString('zh-CN')}
          </div>
          <div className="kpi-label">总记录数</div>
        </div>
        <div className="card soft kpi-card">
          <div className="kpi-value">
            {kpi.originCategories.toLocaleString('zh-CN')}
          </div>
          <div className="kpi-label">籍贯类别数</div>
        </div>
        <div className="card soft kpi-card">
          <div className="kpi-value">
            {kpi.diseaseCategories.toLocaleString('zh-CN')}
          </div>
          <div className="kpi-label">病状类别数</div>
        </div>
        <div className="card soft kpi-card">
          <div className="kpi-value">
            {kpi.cemeteryCategories.toLocaleString('zh-CN')}
          </div>
          <div className="kpi-label">墓地陇名类别数</div>
        </div>
      </div>

      <div className="chart-grid">
        {/* 性别分布 - 饼图 */}
        <div className="card soft card-content-large">
          <h3 className="chart-title">
            性别分布
          </h3>
          <ReactECharts
            option={{
              ...pieOption,
              series: [{
                type: 'pie',
                radius: ['40%', '70%'],
                data: data.gender.map(item => ({ value: item.value, name: item.label })),
                emphasis: {
                  itemStyle: {
                    shadowBlur: 10,
                    shadowOffsetX: 0,
                    shadowColor: 'rgba(31, 107, 255, 0.5)',
                  },
                },
              }],
            }}
            style={{ height: '400px' }}
          />
        </div>

        {/* 年龄段分布 - 柱状图 */}
        <div className="card soft card-content-large">
          <h3 className="chart-title">
            年龄段分布
          </h3>
          <ReactECharts
            option={{
              ...barOption,
              series: [{
                type: 'bar',
                data: data.age.map(item => item.value),
                itemStyle: {
                  color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                      { offset: 0, color: '#1f6bff' },
                      { offset: 1, color: '#3f89ff' },
                    ],
                  },
                },
              }],
              xAxis: {
                ...barOption.xAxis,
                data: data.age.map(item => item.label),
              },
            }}
            style={{ height: '400px' }}
          />
        </div>
      </div>

      {/* 死亡月份趋势 - 折线图 */}
      <div className="card soft card-content-large chart-block">
        <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: 'var(--space-4)', color: 'var(--color-text-primary)' }}>
          死亡人数月度变化趋势
        </h3>
        <ReactECharts
          option={{
            ...lineOption,
            series: [{
              type: 'line',
              data: data.deathMonth.map(item => item.value),
              smooth: true,
              areaStyle: {
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: 'rgba(31, 107, 255, 0.3)' },
                    { offset: 1, color: 'rgba(31, 107, 255, 0.05)' },
                  ],
                },
              },
              lineStyle: {
                color: '#1f6bff',
                width: 3,
              },
              itemStyle: {
                color: '#1f6bff',
              },
            }],
            xAxis: {
              ...lineOption.xAxis,
              data: data.deathMonth.map(item => item.label),
            },
          }}
          style={{ height: '400px' }}
        />
      </div>

      {/* 死亡日期趋势 - Tab切换年份 */}
      {Object.keys(data.deathDate).length > 0 && selectedYear && (
        <div className="card soft card-content-large chart-block">
          <h3 className="chart-title">
            死亡人数日期变化趋势
          </h3>

          {/* Tab导航 */}
          <div className="chart-tab-list">
            {Object.keys(data.deathDate)
              .sort()
              .filter((year) => {
                const yearData = data.deathDate[year];
                return yearData && yearData.length > 0;
              })
              .map((year) => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`chart-tab${selectedYear === year ? ' active' : ''}`}
                >
                  {year}年
                </button>
              ))}
          </div>

          {/* 图表展示 */}
          {data.deathDate[selectedYear] && data.deathDate[selectedYear].length > 0 && (
            <ReactECharts
              option={{
                ...lineOption,
                xAxis: {
                  type: 'category',
                  axisLabel: {
                    rotate: 0,
                    interval: 0,
                    fontSize: 12,
                    formatter: (value: string) => {
                      // 从完整日期（如"1943-03-21"）中提取月份（如"3月"）
                      if (value && value.includes('-')) {
                        const parts = value.split('-');
                        if (parts.length >= 3) {
                          const day = parseInt(parts[2], 10);
                          // 只在每月的第一天显示月份标签
                          if (day === 1) {
                            const month = parseInt(parts[1], 10);
                            return `${month}月`;
                          }
                          // 其他日期不显示标签（返回空字符串）
                          return '';
                        }
                      }
                      return value;
                    },
                  },
                  data: data.deathDate[selectedYear].map(item => item.label),
                },
                series: [{
                  type: 'line',
                  data: data.deathDate[selectedYear].map(item => item.value),
                  smooth: true,
                  areaStyle: {
                    color: {
                      type: 'linear',
                      x: 0,
                      y: 0,
                      x2: 0,
                      y2: 1,
                      colorStops: [
                        { offset: 0, color: 'rgba(31, 107, 255, 0.3)' },
                        { offset: 1, color: 'rgba(31, 107, 255, 0.05)' },
                      ],
                    },
                  },
                  lineStyle: {
                    color: '#1f6bff',
                    width: 3,
                  },
                  itemStyle: {
                    color: '#1f6bff',
                  },
                }],
              }}
              style={{ height: '450px', width: '100%' }}
            />
          )}
        </div>
      )}

      {/* 两列布局 */}
      <div className="chart-grid">
        {/* 籍贯 Top 15 - 柱状图 */}
        <div className="card soft card-content-large">
          <h3 className="chart-title">
            籍贯分布（Top 15）
          </h3>
          <ReactECharts
            option={{
              ...barOption,
              series: [{
                type: 'bar',
                data: data.origin.map(item => item.value),
                itemStyle: {
                  color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 1,
                    y2: 0,
                    colorStops: [
                      { offset: 0, color: '#1f6bff' },
                      { offset: 1, color: '#3f89ff' },
                    ],
                  },
                },
              }],
              xAxis: {
                ...barOption.xAxis,
                data: data.origin.map(item => item.label),
              },
            }}
            style={{ height: '400px' }}
          />
        </div>

        {/* 住址 Top 15 - 柱状图 */}
        <div className="card soft card-content-large">
          <h3 className="chart-title">
            住址分布（Top 15）
          </h3>
          <ReactECharts
            option={{
              ...barOption,
              series: [{
                type: 'bar',
                data: data.address.map(item => item.value),
                itemStyle: {
                  color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 1,
                    y2: 0,
                    colorStops: [
                      { offset: 0, color: '#1f6bff' },
                      { offset: 1, color: '#3f89ff' },
                    ],
                  },
                },
              }],
              xAxis: {
                ...barOption.xAxis,
                data: data.address.map(item => item.label),
              },
            }}
            style={{ height: '400px' }}
          />
        </div>
      </div>

      {/* 籍贯-住址桑基图 */}
      {data.originAddressSankey && data.originAddressSankey.links.length > 0 && (
        <div className="card soft card-content-large chart-block">
          <h3 className="chart-title">
            籍贯-住址流向（Top 30 组合）
          </h3>
          <ReactECharts
            option={{
              ...commonOption,
              tooltip: {
                ...commonOption.tooltip,
                trigger: 'item',
                formatter: formatSankeyTooltip,
              },
              series: [{
                type: 'sankey',
                data: data.originAddressSankey.nodes.map(node => ({
                  ...node,
                  itemStyle: {
                    color: sankeyColors[node.type],
                  },
                })),
                links: data.originAddressSankey.links,
                emphasis: {
                  focus: 'adjacency',
                },
                lineStyle: {
                  color: 'source',
                  opacity: 0.3,
                  curveness: 0.5,
                },
                label: {
                  color: '#1f2937',
                  fontSize: 13,
                  formatter: (params: SankeyTooltipParams) => params.data?.raw || params.name || '',
                },
                nodeAlign: 'justify',
                layoutIterations: 32,
                draggable: false,
              // echarts 未提供 sankey 的完整类型，此处保留断言
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              }] as any,
            }}
            style={{ height: '520px', width: '100%' }}
          />
        </div>
      )}

      {/* 两列布局 */}
      <div className="chart-grid">
        {/* 病状 Top 15 - 柱状图 */}
        <div className="card soft card-content-large">
          <h3 className="chart-title">
            病状分布（Top 15）
          </h3>
          <ReactECharts
            option={{
              ...barOption,
              series: [{
                type: 'bar',
                data: data.disease.map(item => item.value),
                itemStyle: {
                  color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 1,
                    y2: 0,
                    colorStops: [
                      { offset: 0, color: '#1f6bff' },
                      { offset: 1, color: '#3f89ff' },
                    ],
                  },
                },
              }],
              xAxis: {
                ...barOption.xAxis,
                data: data.disease.map(item => item.label),
              },
            }}
            style={{ height: '400px' }}
          />
        </div>

        {/* 墓地陇名分布 - 饼图 */}
        <div className="card soft card-content-large">
          <h3 className="chart-title">
            墓地陇名分布
          </h3>
          <ReactECharts
            option={{
              ...pieOption,
              series: [{
                type: 'pie',
                radius: '60%',
                data: data.cemetery.map(item => ({ value: item.value, name: item.label })),
                emphasis: {
                  itemStyle: {
                    shadowBlur: 10,
                    shadowOffsetX: 0,
                    shadowColor: 'rgba(31, 107, 255, 0.5)',
                  },
                },
              }],
            }}
            style={{ height: '400px' }}
          />
        </div>
      </div>
    </div>
  );
};

export default VisualizationPage;

