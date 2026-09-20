interface TableSkeletonProps {
  /** 骨架行数 */
  rows: number;
  /** 骨架列数（含序号列） */
  cols: number;
}

/** 表格加载占位骨架，搜索页与统计页共用 */
const TableSkeleton = ({ rows, cols }: TableSkeletonProps) => (
  <>
    {Array.from({ length: rows }, (_, row) => (
      <tr key={`skeleton-${row}`}>
        {Array.from({ length: cols }, (_, col) => (
          <td key={`skeleton-${row}-${col}`}>
            <div className={`skeleton ${col === 0 ? 'skeleton-index' : 'skeleton-field'}`} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

export default TableSkeleton;
