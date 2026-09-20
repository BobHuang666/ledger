import { useState, useEffect, useRef } from 'react';
import { search, exportSearch, getFields } from '../api/api';
import type { SearchCondition, RecordItem } from '../api/api';
import { FIELDS as FALLBACK_FIELDS, DEFAULT_FIELD } from '../constants/fields';
import { downloadBlob } from '../utils/download';
import Pagination from './Pagination';
import TableSkeleton from './TableSkeleton';

const SearchPage = () => {
  const [fields, setFields] = useState<string[]>(FALLBACK_FIELDS);
  const [conditions, setConditions] = useState<SearchCondition[]>([
    { field: DEFAULT_FIELD, operator: 'contains', value: '' }
  ]);
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND');
  const [results, setResults] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [browseAll, setBrowseAll] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  // 字段随数据文件变化自动适配，接口不可用时沿用常量兜底
  useEffect(() => {
    getFields()
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          setFields(list);
        }
      })
      .catch(() => {
        /* 保持默认字段 */
      });
  }, []);

  const runSearch = async (requestConditions: SearchCondition[], resetPage: boolean) => {
    const currentPage = resetPage ? 1 : page;
    if (resetPage) setPage(1);

    // 自增请求序号，忽略过期响应，避免快速翻页时结果错乱
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const res = await search({
        conditions: requestConditions,
        logic,
        page: currentPage,
        pageSize,
      });
      if (requestId !== requestIdRef.current) return;

      setResults(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setErrorMsg(null);
    } catch {
      if (requestId === requestIdRef.current) {
        setErrorMsg('搜索失败，请稍后重试');
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleSearch = (resetPage: boolean = true, allowEmpty: boolean = false) => {
    const validConditions = conditions.filter(c => c.value.trim() !== '');
    if (!allowEmpty && validConditions.length === 0) {
      setErrorMsg('请至少填写一个搜索条件，或点击“浏览全部”查看所有记录');
      return;
    }

    setBrowseAll(validConditions.length === 0);
    runSearch(validConditions, resetPage);
  };

  const handleBrowseAll = () => {
    setConditions([{ field: fields[0] ?? DEFAULT_FIELD, operator: 'contains', value: '' }]);
    setBrowseAll(true);
    setErrorMsg(null);
    runSearch([], true);
  };

  // 当分页参数变化时重新搜索
  useEffect(() => {
    const validConditions = conditions.filter(c => c.value.trim() !== '');
    if (validConditions.length > 0 || browseAll) {
      runSearch(validConditions, false);
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
    const validConditions = conditions.filter(c => c.value.trim() !== '');
    if (validConditions.length === 0 && !browseAll) {
      setErrorMsg('请先设置至少一个有效搜索条件');
      return;
    }

    setExporting(true);
    try {
      const blob = await exportSearch({
        conditions: validConditions,
        logic,
      });

      // 使用搜索条件生成文件名
      const filename = validConditions.length === 0
        ? '搜索-全部记录.xlsx'
        : `搜索-${validConditions.map(c => {
            const field = c.field;
            const operatorText = c.operator === 'exact' ? '等于' : '包含';
            return `${field}${operatorText}${c.value}`;
          }).join(`-${logic === 'AND' ? '且' : '或'}-`)}.xlsx`;

      downloadBlob(blob, filename);
    } catch {
      setErrorMsg('导出失败，请稍后重试');
    }
    setExporting(false);
  };

  const addCondition = () => {
    setConditions([...conditions, { field: fields[0] ?? DEFAULT_FIELD, operator: 'contains', value: '' }]);
  };

  const removeCondition = (index: number) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((_, i) => i !== index));
    }
  };

  const updateCondition = (index: number, field: keyof SearchCondition, value: string | 'contains' | 'exact') => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], [field]: value };
    setConditions(newConditions);
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
      <div className="page-header">
        <h2 className="page-heading">收客记录搜索</h2>
        <p className="page-description">
          多条件组合搜索，快速定位历史收客信息；也可直接浏览全部记录。
        </p>
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

      {/* 搜索条件区域 */}
      <div className="card soft card-content">
        {conditions.map((condition, index) => (
          <div key={index} className="search-condition-row">
            {index > 0 && (
              <div className="logic-divider">
                {logic === 'AND' ? '与' : '或'}
              </div>
            )}

            <select
              value={condition.field}
              onChange={(e) => updateCondition(index, 'field', e.target.value)}
              className="select search-condition-field"
            >
              {fields.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>

            <select
              value={condition.operator}
              onChange={(e) => updateCondition(index, 'operator', e.target.value as 'contains' | 'exact')}
              className="select search-condition-operator"
            >
              <option value="contains">包含</option>
              <option value="exact">精确</option>
            </select>

            <input
              value={condition.value}
              onChange={(e) => updateCondition(index, 'value', e.target.value)}
              placeholder="输入关键词"
              className="input search-condition-input"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
            />

            {conditions.length > 1 && (
              <button
                onClick={() => removeCondition(index)}
                className="btn btn-danger search-condition-remove"
              >
                删除
              </button>
            )}
          </div>
        ))}

        <div className="search-actions">
          <div className="logic-switch">
            <select
              value={logic}
              onChange={(e) => setLogic(e.target.value as 'AND' | 'OR')}
              className="select"
            >
              <option value="AND">全部满足（与）</option>
              <option value="OR">任意满足（或）</option>
            </select>
          </div>

          <button
            onClick={addCondition}
            className="btn"
          >
            + 添加条件
          </button>

          <button
            onClick={() => handleSearch(true)}
            disabled={loading}
            className="btn btn-primary btn-search"
          >
            {loading ? '搜索中...' : '搜索'}
          </button>

          <button
            onClick={handleBrowseAll}
            disabled={loading}
            className="btn btn-outline btn-search"
          >
            浏览全部
          </button>

          <button
            onClick={handleExport}
            disabled={exporting || loading || total === 0}
            className="btn btn-ghost btn-export"
          >
            {exporting ? '导出中…' : '导出 Excel'}
          </button>
        </div>
      </div>

      {/* 分页组件 - 上方 */}
      {total > 0 && renderPagination()}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th className="table-th-center">序号</th>
              {fields.map((k) => (
                <th key={k} className="table-th-left">{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && results.length === 0 && (
              <TableSkeleton rows={Math.min(pageSize, 6)} cols={fields.length + 1} />
            )}

            {!loading && results.length === 0 && (
              <tr>
                <td colSpan={fields.length + 1} className="table-empty">
                  暂无数据，请调整搜索条件或点击“浏览全部”。
                </td>
              </tr>
            )}
            {results.map((row, i) => (
              <tr key={i}>
                <td className="table-td-center">
                  {(page - 1) * pageSize + i + 1}
                </td>
                {fields.map((key) => (
                  <td
                    key={key}
                    className="table-td-text"
                    title={String(row[key] ?? '-')}
                  >
                    {String(row[key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页组件 - 下方 */}
      {total > 0 && renderPagination()}
    </div>
  );
};

export default SearchPage;
