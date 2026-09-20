from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Any, Dict, List, Literal, Optional, Tuple
from pathlib import Path
from urllib.parse import quote
import pandas as pd
import math
import io
import os
import threading
from analytics_service import get_analytics_overview

app = FastAPI()

# 允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

DATA_DIR = Path(__file__).resolve().parent / "data"
CSV_PATH = DATA_DIR / "people.csv"


def ensure_csv_ready():
    if CSV_PATH.exists():
        return

    xlsx_files = sorted(DATA_DIR.glob("*.xlsx"))
    if not xlsx_files:
        raise FileNotFoundError(
            "未找到 backend/data/people.csv，且目录下也没有可转换的 .xlsx 文件，请先准备数据再启动服务。"
        )

    # 取最新（按文件名排序后的最后一个）xlsx 转换为 csv
    source_xlsx = xlsx_files[-1]
    df_from_excel = pd.read_excel(source_xlsx, dtype=str)
    df_from_excel.fillna("", inplace=True)
    df_from_excel.to_csv(CSV_PATH, index=False, encoding="utf-8-sig")


ensure_csv_ready()
# 载入 CSV 数据
df = pd.read_csv(CSV_PATH, encoding="utf-8", dtype=str, na_filter=False, keep_default_na=False)

# 替换空值为空字符串
df = df.replace('nan', '')
df = df.replace('None', '')
# df = df.replace('', '（空）')

# 将“同上”替换为上方最近的非“同上”值
def replace_same_as_above(dataframe: pd.DataFrame) -> pd.DataFrame:
    for column in dataframe.columns:
        last_value = None
        filled_column = []
        for value in dataframe[column].astype(str):
            if value == "同上":
                filled_column.append(last_value if last_value is not None else value)
            else:
                last_value = value
                filled_column.append(value)
        dataframe[column] = filled_column
    return dataframe

df = replace_same_as_above(df)

def to_dict_list(filtered_df):
    return filtered_df.to_dict(orient="records")


def apply_search_filters(request: "SearchRequest") -> pd.DataFrame:
    # 无搜索条件时返回全部记录，支持“浏览全部”
    if not request.conditions:
        return df

    condition_masks = []

    for condition in request.conditions:
        if condition.field not in df.columns:
            condition_masks.append(pd.Series([False] * len(df), index=df.index))
            continue

        field_series = df[condition.field].astype(str)
        if condition.operator == "exact":
            mask = field_series.str.strip() == condition.value.strip()
        else:
            # regex=False：关键词按普通文本匹配，避免 ( [ * 等字符被当作正则导致 500
            mask = field_series.str.contains(condition.value, na=False, regex=False)

        condition_masks.append(mask)

    if not condition_masks:
        return df.iloc[0:0]

    if request.logic == "AND":
        combined_mask = condition_masks[0]
        for mask in condition_masks[1:]:
            combined_mask = combined_mask & mask
    else:
        combined_mask = condition_masks[0]
        for mask in condition_masks[1:]:
            combined_mask = combined_mask | mask

    return df[combined_mask]


def paginate_dataframe(filtered_df: pd.DataFrame, page: int, page_size: int) -> Tuple[pd.DataFrame, int, int]:
    total = len(filtered_df)
    total_pages = math.ceil(total / page_size) if total > 0 else 0

    start = (page - 1) * page_size
    end = start + page_size
    paginated_df = filtered_df.iloc[start:end]

    return paginated_df, total, total_pages


def make_excel_response(dataframe: pd.DataFrame, filename: str) -> StreamingResponse:
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        dataframe.to_excel(writer, index=False)
    buffer.seek(0)
    # RFC 6266：非 ASCII 文件名使用 filename* 编码，避免中文名乱码
    headers = {
        "Content-Disposition": f"attachment; filename=\"export.xlsx\"; filename*=UTF-8''{quote(filename)}",
        "Access-Control-Expose-Headers": "Content-Disposition",
    }
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )

# 定义搜索请求模型
class SearchCondition(BaseModel):
    field: str
    operator: Literal["contains", "exact"]
    value: str

class SearchRequest(BaseModel):
    conditions: List[SearchCondition]
    logic: Literal["AND", "OR"] = "AND"
    page: Optional[int] = 1
    pageSize: Optional[int] = 20

# ✅ 1. 高级搜索接口（多字段、精确/模糊匹配，支持分页）
@app.post("/search")
def search(request: SearchRequest):
    filtered_df = apply_search_filters(request)
    page = request.page or 1
    pageSize = request.pageSize or 20
    paginated_df, total, totalPages = paginate_dataframe(filtered_df, page, pageSize)

    return {
        "total": total,
        "page": page,
        "pageSize": pageSize,
        "totalPages": totalPages,
        "data": to_dict_list(paginated_df)
    }


@app.post("/search/export")
def export_search(request: SearchRequest):
    filtered_df = apply_search_filters(request)
    if filtered_df.empty:
        empty_df = pd.DataFrame(columns=df.columns)
        return make_excel_response(empty_df, "search_results.xlsx")
    return make_excel_response(filtered_df, "search_results.xlsx")

# ✅ 2. 通用统计接口（按某字段分组，支持分页）
@app.get("/stats")
def stats(
    field: Optional[str] = Query(None),
    fields: Optional[List[str]] = Query(None),
    page: int = Query(1),
    pageSize: int = Query(20)
):
    selected_fields = fields or ([] if field is None else [field])
    selected_fields = [f for f in selected_fields if f in df.columns]

    if not selected_fields:
        return {
            "total": 0,
            "page": 1,
            "pageSize": pageSize,
            "totalPages": 0,
            "valueTotal": 0,
            "data": []
        }
    
    grouped = df.groupby(selected_fields).size().reset_index(name="value").sort_values(by="value", ascending=False)
    for f in selected_fields:
        grouped[f] = grouped[f].astype(str).replace("nan", "").replace("None", "")
    grouped["key"] = grouped[selected_fields].agg(lambda row: " / ".join(row.tolist()), axis=1)
    stats_list = grouped.to_dict(orient="records")
    value_total = int(grouped["value"].sum()) if not grouped.empty else 0
    
    total = len(stats_list)
    totalPages = math.ceil(total / pageSize) if total > 0 else 0
    
    start = (page - 1) * pageSize
    end = start + pageSize
    
    paginated_data = stats_list[start:end]
    
    return {
        "total": total,
        "page": page,
        "pageSize": pageSize,
        "totalPages": totalPages,
        "valueTotal": value_total,
        "data": paginated_data
    }


@app.get("/stats/export")
def export_stats(
    field: Optional[str] = Query(None),
    fields: Optional[List[str]] = Query(None)
):
    selected_fields = fields or ([] if field is None else [field])
    selected_fields = [f for f in selected_fields if f in df.columns]

    if not selected_fields:
        empty_df = pd.DataFrame(columns=["数量"])
        return make_excel_response(empty_df, "stats.xlsx")

    grouped = df.groupby(selected_fields).size().reset_index(name="数量").sort_values(by="数量", ascending=False)
    for f in selected_fields:
        grouped[f] = grouped[f].astype(str).replace("nan", "").replace("None", "")
    stats_data = grouped[selected_fields + ["数量"]]
    return make_excel_response(stats_data, "stats.xlsx")

@app.get("/fields")
def fields():
    """返回数据文件的字段列表，前端无需硬编码字段"""
    return {"fields": list(df.columns)}


@app.get("/health")
def health():
    """健康检查，供部署平台探活"""
    return {"status": "ok", "rows": len(df)}


# ✅ 3. 数据分析接口
# 数据为静态 CSV，分析结果只需计算一次，后续请求直接命中缓存
_analytics_cache: Dict[str, Any] = {}
_analytics_lock = threading.Lock()


def build_analytics_overview() -> Dict[str, Any]:
    try:
        return get_analytics_overview(df)
    except Exception as e:
        return {
            "error": str(e),
            "gender": [],
            "age": [],
            "origin": [],
            "address": [],
            "disease": [],
            "cemetery": [],
            "deathMonth": [],
            "deathDate": {},
            "total": 0
        }


@app.get("/analytics/overview")
def analytics_overview():
    """获取数据分析概览"""
    if "data" in _analytics_cache:
        return _analytics_cache["data"]

    with _analytics_lock:
        if "data" not in _analytics_cache:
            overview = build_analytics_overview()
            # 仅在成功时写入缓存，避免瞬时故障被永久缓存导致无法自愈
            if "error" not in overview:
                _analytics_cache["data"] = overview
            return overview
        return _analytics_cache["data"]


# ✅ 4. 同源部署：托管前端构建产物（frontend/dist）
# API 路由均在此之前注册，因此 /search、/stats 等不会被静态托管拦截
DIST_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if DIST_DIR.is_dir():
    assets_dir = DIST_DIR / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        """静态文件命中则直接返回，否则回退到 index.html 支持前端路由刷新"""
        target = (DIST_DIR / full_path).resolve()
        if target.is_file() and DIST_DIR in target.parents:
            return FileResponse(target)
        return FileResponse(DIST_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))