"""
数据分析服务模块
提供数据清洗、聚合和统计功能
"""
import pandas as pd
import re
from typing import Dict, List, Any

def pick_last_segment(value: str) -> str:
    """从多段文本中取最后一个有效片段"""
    text = str(value).strip()
    if not text:
        return ''
    segments = [seg.strip() for seg in re.split(r'[/、，,\s]+', text) if seg.strip()]
    return segments[-1] if segments else text


def clean_age(age_str: str) -> int:
    """清洗年龄字段，转换为整数"""
    if not age_str or str(age_str).strip() == '' or str(age_str).lower() in ['nan', 'none', '']:
        return None
    
    age_str = str(age_str).strip()
    
    # 处理"10个月"、"5个月"等格式
    if '个月' in age_str:
        months = re.search(r'(\d+)', age_str)
        if months:
            return int(int(months.group(1)) / 12)  # 转换为年，向下取整
    
    # 处理"约1"、"约2"等格式
    if '约' in age_str:
        age_str = age_str.replace('约', '').strip()
    
    # 提取数字
    numbers = re.findall(r'\d+', age_str)
    if numbers:
        return int(numbers[0])
    
    return None


def categorize_age(age: int) -> str:
    """将年龄分类到年龄段"""
    if age is None:
        return '未知'
    if age < 10:
        return '0-9岁'
    elif age < 20:
        return '10-19岁'
    elif age < 30:
        return '20-29岁'
    elif age < 40:
        return '30-39岁'
    elif age < 50:
        return '40-49岁'
    elif age < 60:
        return '50-59岁'
    elif age < 70:
        return '60-69岁'
    elif age < 80:
        return '70-79岁'
    else:
        return '80岁以上'


def parse_death_months(month_str: str) -> List[str]:
    """解析死亡月份字段，提取所有月份"""
    if not month_str or str(month_str).strip() == '' or str(month_str).lower() in ['nan', 'none', '']:
        return []
    
    month_str = pick_last_segment(month_str)
    months = []
    
    # 分割多种分隔符：/、、
    parts = re.split(r'[/、，, ]+', month_str)
    
    for part in parts:
        part = part.strip()
        if not part:
            continue
        
        # 匹配"1943年3月"格式
        match = re.search(r'(\d{4})年(\d{1,2})月', part)
        if match:
            year = match.group(1)
            month = match.group(2).zfill(2)
            months.append(f"{year}-{month}")
    
    return months if months else []


def parse_death_dates(date_str: str) -> List[str]:
    """解析死亡日期字段，提取所有日期"""
    if not date_str or str(date_str).strip() == '' or str(date_str).lower() in ['nan', 'none', '']:
        return []
    
    date_str = pick_last_segment(date_str)
    dates = []
    
    # 分割多种分隔符：/、、
    parts = re.split(r'[/、，, ]+', date_str)
    
    for part in parts:
        part = part.strip()
        if not part:
            continue
        
        # 匹配"1943.3.21"或"1943-3-21"格式
        match = re.search(r'(\d{4})[.-](\d{1,2})[.-](\d{1,2})', part)
        if match:
            year = match.group(1)
            month = match.group(2).zfill(2)
            day = match.group(3).zfill(2)
            dates.append(f"{year}-{month}-{day}")
    
    return dates if dates else []


def clean_text_field(value: str) -> str:
    """清洗文本字段，统一格式"""
    if not value or str(value).strip() == '' or str(value).lower() in ['nan', 'none', '']:
        return '未知'
    
    value = str(value).strip()
    # 统一处理未知数据
    if value in ['无', '不明', '未知', '']:
        return '未知'
    
    return value


def prepare_analytics_data(df: pd.DataFrame) -> pd.DataFrame:
    """准备分析数据，清洗和转换字段"""
    df_clean = df.copy()
    
    # 清洗性别
    df_clean['性别'] = df_clean['性别'].apply(lambda x: clean_text_field(x))
    
    # 清洗和分类年龄
    df_clean['年龄_数值'] = df_clean['年龄'].apply(clean_age)
    df_clean['年龄段'] = df_clean['年龄_数值'].apply(categorize_age)
    
    # 清洗籍贯
    df_clean['籍贯'] = df_clean['籍贯'].apply(lambda x: clean_text_field(x))
    
    # 清洗住址
    df_clean['住址'] = df_clean['住址'].apply(lambda x: clean_text_field(x))
    
    # 清洗病状
    df_clean['病状'] = df_clean['病状'].apply(lambda x: clean_text_field(x))
    
    # 清洗墓地陇名
    df_clean['墓地陇名'] = df_clean['墓地陇名'].apply(lambda x: clean_text_field(x))
    
    return df_clean


def get_gender_stats(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """获取性别统计"""
    gender_counts = df['性别'].value_counts().to_dict()
    return [{'label': k, 'value': int(v)} for k, v in gender_counts.items()]


def get_age_stats(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """获取年龄段统计"""
    age_counts = df['年龄段'].value_counts().to_dict()
    # 按年龄段排序
    age_order = ['0-9岁', '10-19岁', '20-29岁', '30-39岁', '40-49岁', 
                 '50-59岁', '60-69岁', '70-79岁', '80岁以上', '未知']
    sorted_data = []
    for age_group in age_order:
        if age_group in age_counts:
            sorted_data.append({'label': age_group, 'value': int(age_counts[age_group])})
    return sorted_data


def get_origin_stats(df: pd.DataFrame, top_n: int = 15) -> List[Dict[str, Any]]:
    """获取籍贯统计（Top N）"""
    origin_counts = df['籍贯'].value_counts().head(top_n).to_dict()
    return [{'label': k, 'value': int(v)} for k, v in origin_counts.items()]


def get_address_stats(df: pd.DataFrame, top_n: int = 15) -> List[Dict[str, Any]]:
    """获取住址统计（Top N）"""
    address_counts = df['住址'].value_counts().head(top_n).to_dict()
    return [{'label': k, 'value': int(v)} for k, v in address_counts.items()]


def get_disease_stats(df: pd.DataFrame, top_n: int = 15) -> List[Dict[str, Any]]:
    """获取病状统计（Top N）"""
    disease_counts = df['病状'].value_counts().head(top_n).to_dict()
    return [{'label': k, 'value': int(v)} for k, v in disease_counts.items()]


def get_cemetery_stats(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """获取墓地陇名统计（小于1%的归为其他）"""
    cemetery_counts = df['墓地陇名'].value_counts().to_dict()
    total = sum(cemetery_counts.values())
    
    if total == 0:
        return []
    
    result = []
    other_count = 0
    threshold = total * 0.01  # 1%阈值
    
    for k, v in cemetery_counts.items():
        if v >= threshold:
            result.append({'label': k, 'value': int(v)})
        else:
            other_count += v
    
    # 按数量降序排序
    result.sort(key=lambda x: x['value'], reverse=True)
    
    if other_count > 0:
        result.append({'label': '其他', 'value': int(other_count)})
    
    return result


def get_origin_address_sankey(df: pd.DataFrame, top_links: int = 30) -> Dict[str, Any]:
    """构建籍贯到住址的桑基图数据"""
    if not {'籍贯', '住址'}.issubset(df.columns):
        return {"nodes": [], "links": []}

    temp_df = df[['籍贯', '住址']].copy()
    invalid_values = {'', '未知'}
    temp_df = temp_df[~temp_df['籍贯'].isin(invalid_values)]
    temp_df = temp_df[~temp_df['住址'].isin(invalid_values)]

    if temp_df.empty:
        return {"nodes": [], "links": []}

    grouped = (
        temp_df.groupby(['籍贯', '住址'])
        .size()
        .reset_index(name='value')
        .sort_values(by='value', ascending=False)
    )

    top_grouped = grouped.head(top_links)
    if top_grouped.empty:
        return {"nodes": [], "links": []}

    nodes: Dict[str, Dict[str, Any]] = {}
    links: List[Dict[str, Any]] = []

    def ensure_node(label: str, kind: str) -> str:
        prefix = '籍贯｜' if kind == 'origin' else '住址｜'
        node_name = f"{prefix}{label}"
        if node_name not in nodes:
            nodes[node_name] = {
                "name": node_name,
                "raw": label,
                "type": kind
            }
        return node_name

    for _, row in top_grouped.iterrows():
        origin_label = str(row['籍贯']).strip()
        address_label = str(row['住址']).strip()
        value = int(row['value'])

        if not origin_label or not address_label:
            continue

        origin_node = ensure_node(origin_label, 'origin')
        address_node = ensure_node(address_label, 'address')

        links.append({
            "source": origin_node,
            "target": address_node,
            "value": value,
            "origin": origin_label,
            "address": address_label
        })

    return {
        "nodes": list(nodes.values()),
        "links": links
    }


def get_death_month_timeline(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """获取死亡月份时间序列（排除未知）"""
    # 展开死亡月份
    month_records = []
    for idx, row in df.iterrows():
        months = parse_death_months(row.get('死亡月份', ''))
        if months:
            for month in months:
                month_records.append(month)
    
    if not month_records:
        return []
    
    month_df = pd.DataFrame({'month': month_records})
    month_counts = month_df['month'].value_counts().sort_index().to_dict()
    
    # 排除"未知"，按时间排序
    result = []
    for month, count in sorted(month_counts.items()):
        if month != '未知':
            result.append({'label': month, 'value': int(count)})
    
    return result


def get_death_date_timeline(df: pd.DataFrame) -> Dict[str, List[Dict[str, Any]]]:
    """获取死亡日期时间序列（按年份分组，排除未知）"""
    # 展开死亡日期
    date_records = []
    for idx, row in df.iterrows():
        dates = parse_death_dates(row.get('死亡日期', ''))
        if dates:
            for date in dates:
                if date != '未知':
                    date_records.append(date)
    
    if not date_records:
        return {}
    
    # 按年份分组
    year_data = {}
    for date in date_records:
        if '-' in date:
            year = date.split('-')[0]
            if year not in year_data:
                year_data[year] = []
            year_data[year].append(date)
    
    # 统计每个年份的每日分布（保留完整日期）
    result = {}
    for year, dates in year_data.items():
        date_counts = {}
        for date in dates:
            date_counts[date] = date_counts.get(date, 0) + 1
        
        # 按日期排序
        sorted_dates = sorted(date_counts.items())
        result[year] = [{'label': date, 'value': int(count)} for date, count in sorted_dates]
    
    return result


def get_analytics_overview(df: pd.DataFrame) -> Dict[str, Any]:
    """获取分析概览数据"""
    df_clean = prepare_analytics_data(df)
    
    return {
        'gender': get_gender_stats(df_clean),
        'age': get_age_stats(df_clean),
        'origin': get_origin_stats(df_clean),
        'address': get_address_stats(df_clean),
        'disease': get_disease_stats(df_clean),
        'cemetery': get_cemetery_stats(df_clean),
        'deathMonth': get_death_month_timeline(df_clean),
        'deathDate': get_death_date_timeline(df_clean),
        'originAddressSankey': get_origin_address_sankey(df_clean),
        'total': len(df)
    }

