import { useState, useEffect, useMemo, useRef } from 'react';
import { getStats, exportStats, getFields, type StatsRecord } from '../api/api';
import { FIELDS as FALLBACK_FIELDS } from '../constants/fields';
import { downloadBlob } from '../utils/download';
import Pagination from './Pagination';
import TableSkeleton from './TableSkeleton';

const numberFormatter = new Intl.NumberFormat('zh-CN');

const StatsPage = () => {
  const [fieldOptions, setFieldOptions] = useState<string[]>(FALLBACK_FIELDS);
  const [selectedFields, setSelectedFields] = useState<string[]>(['籍贯']);
  const [stats, setStats] = useState<StatsRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [valueTotal, setValueTotal] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultFields, setResultFields] = useState<string[]>(['籍贯']);
  const requestIdRef = useRef(0);

  // 字段随数据文件变化自动适配，接口不可用时沿用常量兜底
  useEffect(() => {
    getFields()
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          setFieldOptions(list);
        }
      })
      .catch(() => {
        /* 保持默认字段 */
      });
  }, []);

  const availableFields = useMemo(
    () => fieldOptions.filter((option) => !selectedFields.includes(option)),
    [fieldOptions, selectedFields]
  );
  const [fieldPicker, setFieldPicker] = useState<string>('');

  useEffect(() => {
    if (availableFields.length === 0) {
      setFieldPicker('');
    } else if (!availableFields.includes(fieldPicker)) {
      setFieldPicker(availableFields[0]);
    }
  }, [availableFields, fieldPicker]);

  const handleAddField = () => {
    if (!fieldPicker) return;
    setSelectedFields((prev) => [...prev, fieldPicker]);
  };

  const handleRemoveField = (target: string) => {
    if (selectedFields.length === 1) return;
    setSelectedFields((prev) => prev.filter((f) => f !== target));
  };

  const handleReplaceField = () => {
    if (!fieldPicker) return;
    setSelectedFields([fieldPicker]);
  };

  const runStats = async (requestFields: string[], resetPage: boolean) => {
    if (requestFields.length === 0) {
      setErrorMsg('请至少选择一个统计字段');
      return;
    }

    const currentPage = resetPage ? 1 : page;
    if (resetPage) setPage(1);

    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const res = await getStats(requestFields, currentPage, pageSize);
      if (requestId !== requestIdRef.current) return;

      setStats(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setValueTotal(res.valueTotal ?? 0);
      setResultFields([...requestFields]);
      setErrorMsg(null);
    } catch {
      if (requestId === requestIdRef.current) {
        setErrorMsg('统计失败，请稍后重试');
        if (resetPage) {
          setStats([]);
          setValueTotal(0);
        }
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleStats = (resetPage: boolean = true) => {
    runStats(selectedFields, resetPage);
  };

  // 当分页参数变化时重新统计
  useEffect(() => {
    if (stats.length > 0 || total > 0) {
      runStats(selectedFields, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
  };

  const handleExport = async () => {
    if (total === 0) {
      setErrorMsg('暂无统计数据可导出');
      return;
    }
    if (selectedFields.length === 0) {
      setErrorMsg('请至少选择一个统计字段');
      return;
    }

    setExporting(true);
    try {
      const blob = await exportStats(selectedFields);
      const filename = `统计-${selectedFields.join('-')}.xlsx`;
      downloadBlob(blob, filename);
    } catch {
      setErrorMsg('导出失败，请稍后重试');
    }
    setExporting(false);
  };

  const renderPagination = () => (
    <Pagination
      page={page}
      pageSize={pageSize}
      total={total}
      totalPages={totalPages}
      onPageChange={handlePageChange}
      onPageSizeChange={handlePageSizeChange}
    />
  );

  return (
    <div className="page-container">
      <div className="stats-header">
        <div className="stats-header-content">
          <h2 className="page-heading">收客记录统计</h2>
          <p className="page-description">
            支持多字段组合统计，建议控制字段数量在 3 个以内以便阅读。
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="alert alert-error" role="alert">
          <span>{errorMsg}</span>
          <button
            type="button"
            className="alert-close"
            onClick={() => setErrorMsg(null)}
            aria-label="关闭提示"
          >
            ×
          </button>
        </div>
      )}

      <div className="card soft card-content-large">
        {/* 第一行：字段选择区域 */}
        <div className="stats-field-selector">
          <select
            value={fieldPicker}
            onChange={(e) => setFieldPicker(e.target.value)}
            className="select"
            disabled={availableFields.length === 0}
          >
            {availableFields.length === 0 ? (
              <option value="">无更多字段</option>
            ) : (
              availableFields.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))
            )}
          </select>
          <button
            onClick={handleReplaceField}
            className="btn btn-outline"
            disabled={!fieldPicker}
          >
            替换字段
          </button>
          <button
            onClick={handleAddField}
            disabled={!fieldPicker}
            className="btn"
          >
            + 添加字段
          </button>
        </div>

        {/* 第二行：已选字段展示 + 操作按钮 */}
        <div className="stats-actions-row">
          {/* 已选字段标签区域 */}
          <div className="stats-fields-container">
            <div className="stats-fields-tags">
              {selectedFields.length === 0 ? (
                <span className="subtle-text stats-field-empty-text">
                  请先添加统计字段
                </span>
              ) : (
                <>
                  <span className="stats-field-label">
                    统计字段：
                  </span>
                  {selectedFields.map((f) => (
                    <span
                      key={f}
                      className="stats-field-tag"
                    >
                      {f}
                      {selectedFields.length > 1 && (
                        <button
                          onClick={() => handleRemoveField(f)}
                          className="btn btn-ghost stats-field-remove-btn"
                          title="移除字段"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* 操作按钮区域 */}
          <div className="stats-buttons-group">
            <button
              onClick={() => handleStats(true)}
              disabled={loading || selectedFields.length === 0}
              className="btn btn-primary btn-stats"
            >
              {loading ? '统计中...' : '生成统计'}
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || loading || total === 0}
              className="btn btn-ghost btn-export-stats"
            >
              {exporting ? '导出中…' : '导出 Excel'}
            </button>
          </div>
        </div>
      </div>

      {/* 分页组件 - 上方 */}
      {total > 0 && renderPagination()}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th className="table-th-index">序号</th>
              {resultFields.map((fieldKey) => (
                <th key={fieldKey} className="table-th-field">{fieldKey}</th>
              ))}
              <th className="table-th-count">数量</th>
              <th className="table-th-percent">占比</th>
            </tr>
          </thead>
          <tbody>
            {loading && stats.length === 0 && (
              <TableSkeleton rows={Math.min(pageSize, 6)} cols={resultFields.length + 3} />
            )}

            {!loading && stats.length === 0 && (
              <tr>
                <td colSpan={resultFields.length + 3} className="table-empty">
                  暂无数据，请选择其他字段或调整筛选条件。
                </td>
              </tr>
            )}

            {stats.map((item, i) => {
              const percentBase = valueTotal > 0 ? (item.value / valueTotal) * 100 : 0;
              const percent = Math.round(percentBase * 10) / 10;
              const progress = Math.min(Math.max(percentBase, 0), 100);

              return (
                <tr key={item.key}>
                  <td className="table-td-center">
                    {(page - 1) * pageSize + i + 1}
                  </td>
                  {resultFields.map((fieldKey) => (
                    <td
                      key={fieldKey}
                      className="table-td-text"
                      title={item[fieldKey] ?? ''}
                    >
                      {item[fieldKey] ?? ''}
                    </td>
                  ))}
                  <td className="table-td-bold">
                    {numberFormatter.format(item.value)}
                  </td>
                  <td>
                    <div className="progress-container">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${progress}%`,
                            minWidth: percent > 0 ? '6px' : '0',
                          }}
                        />
                      </div>
                      <span className="subtle-text">{percent}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 分页组件 - 下方 */}
      {total > 0 && renderPagination()}
    </div>
  );
};

export default StatsPage;
