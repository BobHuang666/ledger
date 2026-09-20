import { useState } from 'react';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** 生成页码按钮数组：首页、末页、当前页及前后页，其余用省略号 */
const getPageNumbers = (page: number, totalPages: number): (number | string)[] => {
  const pages: (number | string)[] = [];
  const showPages = 5;

  if (totalPages <= showPages) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  if (page <= 3) {
    for (let i = 1; i <= 5; i++) {
      pages.push(i);
    }
    pages.push('...');
    pages.push(totalPages);
  } else if (page >= totalPages - 2) {
    pages.push(1);
    pages.push('...');
    for (let i = totalPages - 4; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);
    pages.push('...');
    for (let i = page - 1; i <= page + 1; i++) {
      pages.push(i);
    }
    pages.push('...');
    pages.push(totalPages);
  }

  return pages;
};

const Pagination = ({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) => {
  const [jumpToPage, setJumpToPage] = useState('');

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const pageNumbers = getPageNumbers(page, totalPages);

  const handleJump = () => {
    const pageNum = parseInt(jumpToPage, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setJumpToPage('');
    }
  };

  return (
    <div className="pagination">
      <div className="pagination-row">
        <span className="subtle-text">显示 {start}-{end} 条，共 {total} 条</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="select pagination-page-size"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
        <span className="subtle-text">条/页</span>
      </div>

      <div className="pagination-row">
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="btn btn-ghost"
        >
          首页
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="btn btn-ghost"
        >
          上一页
        </button>

        {pageNumbers.map((p, idx) => (
          <span key={idx}>
            {p === '...' ? (
              <span className="subtle-text pagination-ellipsis">...</span>
            ) : (
              <button
                onClick={() => onPageChange(p as number)}
                className={p === page ? 'btn btn-primary' : 'btn btn-ghost'}
                style={p === page ? {} : { boxShadow: 'inset 0 0 0 1px var(--color-border)' }}
              >
                {p}
              </button>
            )}
          </span>
        ))}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="btn btn-ghost"
        >
          下一页
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className="btn btn-ghost"
        >
          末页
        </button>

        <div className="pagination-group">
          <span className="subtle-text">跳转到</span>
          <input
            type="number"
            value={jumpToPage}
            onChange={(e) => setJumpToPage(e.target.value)}
            placeholder="页"
            min={1}
            max={totalPages}
            className="input pagination-jump-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleJump();
            }}
          />
          <button onClick={handleJump} className="btn">
            跳转
          </button>
        </div>
      </div>
    </div>
  );
};

export default Pagination;
