# -*- coding: utf-8 -*-
import os
import sys
import asyncio

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from typing import List, Optional
from dotenv import load_dotenv

# HuggingFace 캐시 디렉터리를 로컬 프로젝트 폴더 안으로 설정 (권한 에러 방지)
os.environ["HF_HOME"] = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hf_cache")
os.environ["SENTENCE_TRANSFORMERS_HOME"] = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hf_cache")

from fastapi import FastAPI
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI   # Gemini
from langchain_huggingface import HuggingFaceEmbeddings  # 로컬 임베딩 (무료)
from langchain_chroma import Chroma

# [1] .env 파일에서 GOOGLE_API_KEY 로드
load_dotenv()

app = FastAPI(title="Gwangju Youth Policy AI API")

# [2] Gemini Flash 모델 선언 (무료 tier 사용)
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0)

# 🌐 실시간 동적 상세 페이지 URL 탐색기 (Dynamic Realtime Resolver)
import time
import json
import re
from urllib.parse import urlparse
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.keys import Keys

# policy_details/ 폴더의 모든 텍스트 파일을 파싱하여 정책명 -> apply_link (일반링크) 매핑 사전 구축 및 캐시 메모리 로드
txt_apply_links = {}
policy_links_cache = {}
txt_policy_deadlines = {}  # 정책명 -> 마감기한 문자열
policy_file_map = {}       # 정책명 -> 텍스트 파일명
txt_policy_categories = {} # 정책명 -> 카테고리 (지원 분야)
txt_policy_agencies = {}   # 정책명 -> 소관 기관

def clean_category(raw_cat: str) -> str:
    if not raw_cat:
        return "복지/문화"
    cat = raw_cat.strip()
    if "주거" in cat or "자립" in cat:
        return "주거"
    elif "고용" in cat or "창업" in cat or "일자리" in cat or "취업" in cat or "근로" in cat or "노동" in cat:
        return "일자리"
    elif "교육" in cat or "보육" in cat or "학업" in cat or "학교" in cat or "학생" in cat or "대학" in cat or "장학" in cat:
        return "교육"
    elif "참여" in cat or "권리" in cat or "공동체" in cat or "시민" in cat or "활동" in cat:
        return "참여/권리"
    else:
        return "복지/문화"


def is_region_mismatched(policy_text: str, user_region: str) -> bool:
    """
    policy_text: 정책 제목 + 소관기관 + 본문 합친 텍스트
    user_region: 예) "광주광역시 북구"
    반환: True = 제외해야 함, False = 노출해야 함
    """

    # 광역시/도 추출 (예: "광주광역시 북구" -> "광주")
    sido_aliases = {
        "서울": ["서울"],
        "부산": ["부산"],
        "대구": ["대구"],
        "인천": ["인천"],
        "광주": ["광주"],
        "대전": ["대전"],
        "울산": ["울산"],
        "세종": ["세종"],
        "경기": ["경기"],
        "강원": ["강원"],
        "충북": ["충북", "충청북도"],
        "충남": ["충남", "충청남도"],
        "전북": ["전북", "전라북도"],
        "전남": ["전남", "전라남도"],
        "경북": ["경북", "경상북도"],
        "경남": ["경남", "경상남도"],
        "제주": ["제주"],
    }

    # 구/군 단위 추출 (예: "북구")
    gu_aliases = {
        "광주": ["동구", "서구", "남구", "북구", "광산구"],
        "서울": ["강남구", "강북구", "강서구", "강동구", "종로구", "중구",
                 "용산구", "성동구", "광진구", "동대문구", "중랑구", "성북구",
                 "도봉구", "노원구", "은평구", "서대문구", "마포구", "양천구",
                 "구로구", "금천구", "영등포구", "동작구", "관악구", "서초구",
                 "송파구", "강동구"],
        # 필요 시 다른 도시 구 목록 추가
    }

    # 사용자 광역 키 파악
    user_sido_key = None
    for key, aliases in sido_aliases.items():
        if any(alias in user_region for alias in aliases):
            user_sido_key = key
            break

    # 사용자 구/군 키 파악
    user_gu = None
    if user_sido_key and user_sido_key in gu_aliases:
        for gu in gu_aliases[user_sido_key]:
            if gu in user_region:
                user_gu = gu
                break

    # ── 타 광역시/도 명시 여부 체크 ──
    for key, aliases in sido_aliases.items():
        if key == user_sido_key:
            continue  # 사용자 지역은 스킵
        for alias in aliases:
            # 텍스트에 타 광역시/도명이 명시되어 있으면 제외
            if alias in policy_text:
                return True  # ❌ 제외

    # ── 타 구/군 명시 여부 체크 (같은 광역시 내) ──
    if user_sido_key and user_gu and user_sido_key in gu_aliases:
        for gu in gu_aliases[user_sido_key]:
            if gu == user_gu:
                continue  # 사용자 구는 스킵
            if gu in policy_text:
                return True  # ❌ 광주 내 타 구 명시 -> 제외

    return False  # ✅ 노출

# special 항목이 없는데 해당 키워드가 정책 텍스트에 있으면 제외
SPECIAL_EXCLUSIVE_KEYWORDS = {
    # 가족/양육
    "아기를 키우고 있어요":         ["영아", "육아", "어린이집", "보육료", "출산"],
    "아이 둘 이상이에요":           ["다자녀", "둘째", "셋째"],
    "학생 자녀가 있어요":           ["자녀학비", "자녀교육"],
    "다양한 가족이에요":            ["다문화가족", "다문화 가족", "다문화가정"],
    "혼자(또는 조부모) 키워요":     ["한부모", "조손가정", "한부모가족"],
    "임신 준비 중이에요":           ["난임", "임신준비"],
    "임신 중이에요":                ["임산부", "임신부", "태아"],
    "출산 직후예요":                ["출산", "신생아", "산모"],
    "육아휴직 중이에요":            ["육아휴직"],
    "부모님을 돌보고 있어요":       ["노인돌봄", "요양보호", "가족돌봄"],
    "장기요양이 필요해요":          ["장기요양", "요양등급"],
    "치매 돌봄이 필요해요":         ["치매"],
    "혼자(어르신) 살고 있어요":     ["독거노인", "노인 독거"],

    # 생활비/자립
    "신혼부부예요":                 ["신혼부부", "신혼"],
    "학교 밖 청소년이에요":         ["학교밖", "학교 밖 청소년"],
    "돌봄을 졸업했어요":            ["자립준비청년", "보호종료"],
    "위탁가정(돌봄가정)에서 지내요":["위탁아동", "위탁가정", "가정위탁"],
    "군을 제대했어요":              ["전역", "제대군인", "보훈"],
    "학자금 대출을 갚고 있어요":    ["학자금대출", "학자금 대출"],
    "65세 이상이에요":              ["노인", "고령자", "어르신", "65세"],

    # 직업/업종
    "농업/임업에 종사해요":         ["농업", "임업", "농촌", "농림"],
    "어업에 종사해요":              ["어업", "어촌", "수산"],
    "축산에 종사해요":              ["축산"],
    "귀농·귀촌·귀어 준비 중이에요": ["귀농", "귀촌", "귀어"],
    "소상공인이에요":               ["소상공인"],
    "장사가 어려운 소상공인이에요": ["소상공인 경영위기", "폐업", "소상공인 재기"],
    "대출이 있는 소상공인이에요":   ["소상공인 대출", "소상공인 융자"],
    "재도약을 준비하는 기업이에요": ["재창업", "기업재도약"],
    "프리랜서/플랫폼 노동자예요":   ["플랫폼노동", "프리랜서", "특수형태근로"],
    "문화·체육·건설·교직원이에요":  ["예술인", "체육인", "건설근로자", "교직원"],

    # 현재 상황/취약계층
    "보훈대상자/가족이에요":        ["보훈", "국가유공자", "보훈대상"],
    "기초생활수급자예요":           ["기초생활수급", "기초수급자", "기초생활보장"],
    "저소득 가구예요":              ["저소득층", "차상위"],
    "긴급복지를 받고 있어요":       ["긴급복지"],
    "재난·사고 피해자예요":         ["재난", "재해", "사고피해"],
    "범죄·폭력 피해자예요":         ["범죄피해", "가정폭력", "성폭력피해"],
    "재취업 준비 중인 중장년이에요":["중장년", "장년층", "40대", "50대"],
    "전세자금 대출이 필요해요":     ["전세자금", "전세대출"],
    "공공임대주택에 입주하고 싶어요":["공공임대", "임대주택", "LH"],
    "주거가 취약해요":              ["쪽방", "고시원", "비닐하우스", "주거취약"],
    "연금을 받고 있어요":           ["연금수급", "국민연금수급"],

    # 장애
    "일자리를 찾는 장애인이에요":   ["장애인 고용", "장애인 취업", "장애인일자리"],
    "장애인/가족이에요":            ["장애인", "장애아동", "장애"],
    "장애아동이에요":               ["장애아동", "발달지연"],
    "발달장애가 있어요":            ["발달장애"],
    "시설을 이용하고 있어요":       ["복지시설", "장애인시설", "거주시설"],

    # 의료
    "만성질환자에요":               ["만성질환", "고혈압", "당뇨"],
    "암 치료를 받고 있어요":        ["암환자", "암치료", "항암"],

    # 특수교육 (별도 처리)
    "_특수교육":                    ["특수교육", "특수학교", "특수학급"],
}

def is_special_mismatched(policy_text: str, user_special: list) -> bool:
    """
    사용자가 선택하지 않은 특수 조건의 키워드가
    정책 텍스트에 명시되어 있으면 True(제외) 반환
    """
    for special_key, keywords in SPECIAL_EXCLUSIVE_KEYWORDS.items():
        # 사용자가 이 special 항목을 선택한 경우 → 스킵 (노출 허용)
        if special_key in user_special:
            continue
        # 사용자가 선택 안 했는데 정책 텍스트에 해당 키워드가 있으면 → 제외
        for kw in keywords:
            if kw in policy_text:
                return True  # ❌ 제외
    return False  # ✅ 노출

def is_base_link(url: str) -> bool:
    if not url or url == "unknown":
        return True
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        path = parsed.path.strip("/")
        if path in ("", "portal", "index.html", "index.jsp", "main.do", "main"):
            return True
        domain = parsed.netloc.lower()
        if any(portal in domain for portal in ["gov.kr", "bokjiro.go.kr", "work24.go.kr", "jpdc.co.kr", "jobaba.net"]):
            if not parsed.query:
                return True
        return False
    except Exception:
        return True

txt_policy_categories = {} # 정책명 -> 카테고리 (지원 분야)
txt_policy_agencies = {}   # 정책명 -> 소관 기관

def clean_category(raw_cat: str) -> str:
    if not raw_cat:
        return "복지/문화"
    cat = raw_cat.strip()
    if "주거" in cat or "자립" in cat:
        return "주거"
    elif "고용" in cat or "창업" in cat or "일자리" in cat or "취업" in cat or "근로" in cat or "노동" in cat:
        return "일자리"
    elif "교육" in cat or "보육" in cat or "학업" in cat or "학교" in cat or "학생" in cat or "대학" in cat or "장학" in cat:
        return "교육"
    elif "참여" in cat or "권리" in cat or "공동체" in cat or "시민" in cat or "활동" in cat:
        return "참여/권리"
    else:
        return "복지/문화"


def load_all_policy_links_cache():
    global txt_apply_links, policy_links_cache, txt_policy_deadlines, policy_file_map, txt_policy_categories, txt_policy_agencies
    txt_apply_links.clear()
    policy_links_cache.clear()
    txt_policy_deadlines.clear()
    policy_file_map.clear()
    txt_policy_categories.clear()
    txt_policy_agencies.clear()
    
    # 1. policy_details 디렉토리 내 모든 txt 파일에서 실제 링크 및 마감 기한 파싱
    policy_dir = os.path.join(os.path.dirname(__file__), "policy_details")
    if os.path.exists(policy_dir):
        try:
            for file in os.listdir(policy_dir):
                if file.endswith(".txt"):
                    path = os.path.join(policy_dir, file)
                    with open(path, "r", encoding="utf-8") as f:
                        content = f.read()
                    
                    # 정책제목 추출
                    title_match = re.search(r"정책제목:\s*(.*)", content)
                    title = title_match.group(1).strip() if title_match else os.path.splitext(file)[0]
                    clean_name = re.sub(r"^\([^)]+\)\s*", "", title).strip()
                    
                    policy_file_map[title] = file
                    policy_file_map[clean_name] = file
                    
                    # 마감기한 추출
                    end_date_match = re.search(r"(?:신청 기한|신청기한|신청 기간|신청기간):\s*(.*)", content)
                    end_date = end_date_match.group(1).strip() if end_date_match else "unknown"
                    
                    # 마감기한 보조 파싱 (상세내용이나 실시간 정보에서 추가 매칭)
                    if end_date == "unknown" or end_date == "":
                        # "신청기간" 다음 행의 단어 매칭
                        detail_match = re.search(r"신청기간\s*\n\s*(마감|상시|.*)", content)
                        if detail_match:
                            end_date = detail_match.group(1).strip()
                    
                    txt_policy_deadlines[title] = end_date
                    txt_policy_deadlines[clean_name] = end_date
                    
                    # 카테고리(지원 분야) 추출
                    cat_match = re.search(r"지원 분야:\s*(.*)", content)
                    raw_cat = cat_match.group(1).strip() if cat_match else "unknown"
                    txt_policy_categories[title] = raw_cat
                    txt_policy_categories[clean_name] = raw_cat
                    
                    # 소관 기관 추출
                    agency_match = re.search(r"소관 기관:\s*(.*)", content)
                    raw_agency = agency_match.group(1).strip() if agency_match else "정보 없음"
                    txt_policy_agencies[title] = raw_agency
                    txt_policy_agencies[clean_name] = raw_agency
                    
                    # 일반 링크 추출
                    link_match = re.search(r"링크:\s*(.*)", content)
                    apply_link = link_match.group(1).strip() if link_match else "unknown"
                    if apply_link and apply_link != "unknown" and apply_link.strip() != "":
                        txt_apply_links[title] = apply_link
                        txt_apply_links[clean_name] = apply_link
            print(f"[Startup] Loaded {len(txt_apply_links)} general links, categories, and agencies from policy_details txt files.")
        except Exception as e:
            print(f"[Startup] Error loading general links from policy_details: {e}")
            
    # 2. policy_links.json을 읽어서 추가/폴백 매핑 보충 및 캐시 초기화
    links_path = os.path.join(os.path.dirname(__file__), "policy_links.json")
    if os.path.exists(links_path):
        try:
            with open(links_path, "r", encoding="utf-8") as f:
                policy_links_cache = json.load(f)
            print(f"[Startup] Loaded {len(policy_links_cache)} cached links from policy_links.json.")
            
            # txt_apply_links에도 보충
            for title, info in policy_links_cache.items():
                apply_link = info.get("apply_link", "")
                if apply_link and apply_link.strip() != "":
                    if title not in txt_apply_links:
                        txt_apply_links[title] = apply_link
                    clean_name = re.sub(r"^\([^)]+\)\s*", "", title).strip()
                    if clean_name not in txt_apply_links:
                        txt_apply_links[clean_name] = apply_link
        except Exception as e:
            print(f"[Startup] Error loading policy_links.json: {e}")

import difflib

def find_best_policy_title_match(policy_name: str):
    actual_titles = list(policy_file_map.keys())
    if not actual_titles:
        return None, 0.0
        
    clean_name = re.sub(r"^\([^)]+\)\s*", "", policy_name).strip()
    if policy_name in policy_file_map:
        return policy_name, 1.0
    if clean_name in policy_file_map:
        return clean_name, 1.0
        
    best_title = None
    best_ratio = 0.0
    for title in actual_titles:
        ratio = difflib.SequenceMatcher(None, policy_name, title).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_title = title
            
        ratio_clean = difflib.SequenceMatcher(None, clean_name, title).ratio()
        if ratio_clean > best_ratio:
            best_ratio = ratio_clean
            best_title = title
            
    return best_title, best_ratio

# Startup시 즉시 실행
load_all_policy_links_cache()

# 디버그용 출력 추가
print(f"[DEBUG] txt_apply_links 로딩 건수: {len(txt_apply_links)}")

def parse_last_date(cleaned: str):
    import calendar
    from datetime import date
    # ~ 이나 - 문구를 기준으로 시작/종료일 분리
    parts = re.split(r'~| - |(?<=\d)-(?=\d)', cleaned)
    
    # 종료일 부분부터 우선 파싱 시도 (역순 루프)
    for part in reversed(parts):
        part = part.strip()
        numbers = [int(x) for x in re.findall(r'\d+', part)]
        if not numbers:
            continue
            
        # 1. 종료일에 년, 월, 일이 모두 포함된 경우 (예: 2026.11.30, 또는 11.30 (월) 23시처럼 시 분 초가 섞인 형태)
        if len(numbers) >= 3:
            # 첫 숫자가 년도 형식(예: 2026 혹은 26)인 경우
            if numbers[0] > 1000 or (numbers[0] > 20 and numbers[0] < 100):
                try:
                    y, m, d = numbers[0], numbers[1], numbers[2]
                    if y < 100: y += 2000
                    return date(y, m, d)
                except ValueError:
                    pass
            
            # 첫 숫자가 년도가 아니지만(예: 11.30.23 -> [11, 30, 23]), 첫 번째 파트(시작일)에 년도가 있을 경우 년도 빌려옴
            first_part_numbers = [int(x) for x in re.findall(r'\d+', parts[0])]
            if first_part_numbers and first_part_numbers[0] > 100:
                y = first_part_numbers[0]
                if y < 100: y += 2000
                try:
                    return date(y, numbers[0], numbers[1])
                except ValueError:
                    pass
                    
            # 최후의 수단으로 현재 년도 대입
            try:
                y = date.today().year
                return date(y, numbers[0], numbers[1])
            except ValueError:
                pass
                
        # 2. 종료일에 숫자 2개만 있는 경우 (예: 11.30 -> [11, 30])
        elif len(numbers) == 2:
            first_part_numbers = [int(x) for x in re.findall(r'\d+', parts[0])]
            if first_part_numbers and first_part_numbers[0] > 100:
                y = first_part_numbers[0]
                if y < 100: y += 2000
                try:
                    return date(y, numbers[0], numbers[1])
                except ValueError:
                    pass
            try:
                y = date.today().year
                return date(y, numbers[0], numbers[1])
            except ValueError:
                pass
                
    # 3. 전체 문자열 숫자 파싱 백업 로직
    all_numbers = [int(x) for x in re.findall(r'\d+', cleaned)]
    if len(all_numbers) >= 6:
        try:
            y2, m2, d2 = all_numbers[3], all_numbers[4], all_numbers[5]
            if y2 < 100: y2 += 2000
            return date(y2, m2, d2)
        except ValueError:
            pass
    if len(all_numbers) == 5:
        try:
            y1, m1, d1, m2, d2 = all_numbers[0], all_numbers[1], all_numbers[2], all_numbers[3], all_numbers[4]
            if y1 < 100:
                y1 += 2000
            return date(y1, m2, d2)
        except ValueError:
            pass
    if len(all_numbers) == 3:
        try:
            y, m, d = all_numbers[0], all_numbers[1], all_numbers[2]
            if y < 100:
                y += 2000
            return date(y, m, d)
        except ValueError:
            pass
    if len(all_numbers) == 2:
        y, m = all_numbers[0], all_numbers[1]
        if y > 1000:
            if y < 100:
                y += 2000
            try:
                last_day = calendar.monthrange(y, m)[1]
                return date(y, m, last_day)
            except ValueError:
                pass
    return None

def is_policy_expired(end_date_str: str) -> bool:
    if not end_date_str:
        return False
    cleaned = end_date_str.strip()
    
    closed_keywords = ["신청마감", "접수마감", "종료", "신청종료", "마감", "마감됨"]
    for kw in closed_keywords:
        if kw in cleaned:
            return True
            
    ignore_keywords = ["상시", "연중", "소진", "미정", "unknown"]
    if any(k in cleaned for k in ignore_keywords):
        return False
        
    last_date = parse_last_date(cleaned)
    if last_date:
        from datetime import date
        return last_date < date.today()
        
    return False

def extract_ground_truth_policy_details(file_name: str) -> dict:
    policy_dir = os.path.join(os.path.dirname(__file__), "policy_details")
    path = os.path.join(policy_dir, file_name)
    if not os.path.exists(path):
        return {}
        
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
            
        details = {}
        
        title_match = re.search(r"정책제목:\s*(.*)", content)
        details['policy_name'] = title_match.group(1).strip() if title_match else os.path.splitext(file_name)[0]
        
        link_match = re.search(r"링크:\s*(.*)", content)
        details['apply_link'] = link_match.group(1).strip() if link_match else "unknown"
        
        cat_match = re.search(r"지원 분야:\s*(.*)", content)
        details['interest'] = clean_category(cat_match.group(1).strip() if cat_match else "복지/문화")
        
        agency_match = re.search(r"소관 기관:\s*(.*)", content)
        if not agency_match:
            agency_match = re.search(r"접수 기관:\s*(.*)", content)
        details['agency'] = agency_match.group(1).strip() if agency_match else "정보 없음"
        if details['agency'] == "정보 없음" or details['agency'] == "":
            tel_match = re.search(r"전화 문의:\s*(.*)", content)
            if tel_match:
                details['agency'] = tel_match.group(1).strip().split('/')[0]
                
        method_match = re.search(r"(?:신청 방법|신청방법|접수방법|접수 방법):\s*(.*)", content)
        if method_match:
            method_text = method_match.group(1).strip()
            method_idx = content.find(method_match.group(0))
            after_method = content[method_idx + len(method_match.group(0)):]
            lines = []
            if method_text:
                lines.append(method_text)
            for line in after_method.split('\n'):
                line = line.strip()
                if not line:
                    continue
                if any(line.startswith(prefix) for prefix in ["접수 기관:", "접수기관:", "전화 문의:", "전화문의:", "필요 제출 서류:", "필요제출서류:", "해당없음"]):
                    break
                lines.append(line)
            details['apply_method'] = " / ".join(lines[:3])
        else:
            details['apply_method'] = "정보 없음"
            
        end_date_match = re.search(r"(?:신청 기한|신청기한|신청 기간|신청기간):\s*(.*)", content)
        details['end_date'] = end_date_match.group(1).strip() if end_date_match else "unknown"
        
        docs = []
        doc_idx = content.find("필요 제출 서류:")
        if doc_idx == -1:
            doc_idx = content.find("제출 서류:")
        if doc_idx != -1:
            after_docs = content[doc_idx:]
            lines = after_docs.split('\n')[1:]
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                if line.startswith("-") or line.startswith("○") or line.startswith("•") or line.startswith("*"):
                    doc_item = line.lstrip("-○•* ").strip()
                    if doc_item and doc_item != "해당없음":
                        docs.append(doc_item)
                elif any(line.startswith(prefix) for prefix in ["접수 기관:", "전화 문의:"]):
                    break
                elif len(docs) < 10 and len(line) < 40 and not line.startswith("정책제목") and not line.startswith("상세내용"):
                    if line != "해당없음":
                        docs.append(line)
        details['required_documents'] = docs
        
        eligibility_match = re.search(r"지원 대상:\s*(.*)", content)
        if eligibility_match:
            elig_text = eligibility_match.group(1).strip()
            elig_idx = content.find(eligibility_match.group(0))
            after_elig = content[elig_idx + len(eligibility_match.group(0)):]
            lines = []
            if elig_text:
                lines.append(elig_text)
            for line in after_elig.split('\n'):
                line = line.strip()
                if not line:
                    continue
                if any(line.startswith(prefix) for prefix in ["선정 기준:", "지원 내용:", "신청 기한:", "신청 방법:", "필요 제출 서류:"]):
                    break
                lines.append(line)
            details['eligibility'] = "\n".join(lines[:5])
        else:
            details['eligibility'] = "본문 내용 참고"

        # ── condition_text 수집 (필터링 전용 텍스트) ──
        condition_parts = []

        CONDITION_FIELDS = [
            "지원 대상:",
            "지원 내용:",
            "선정 기준:",
            "서비스 목적:",
            "지원 분야:",
        ]

        STOP_PREFIXES = [
            "신청 기한:", "신청기한:",
            "신청 방법:", "신청방법:",
            "접수 방법:", "접수방법:",
            "필요 제출 서류:", "필요제출서류:",
            "접수 기관:", "접수기관:",
            "전화 문의:", "전화문의:",
            "소관 기관:", "소관기관:",
            "링크:",
        ]

        for field in CONDITION_FIELDS:
            field_match = re.search(re.escape(field) + r"\s*(.*)", content)
            if not field_match:
                continue
            idx = content.find(field_match.group(0))
            after = content[idx + len(field_match.group(0)):]
            lines = []
            first_line = field_match.group(1).strip()
            if first_line:
                lines.append(first_line)
            for line in after.split('\n'):
                line = line.strip()
                if not line:
                    continue
                if any(line.startswith(p) for p in STOP_PREFIXES):
                    break
                lines.append(line)
            condition_parts.append(" ".join(lines))

        details['condition_text'] = " ".join(condition_parts)
        details['full_text'] = content  # 혹시 필요할 때 사용
            
        return details
    except Exception as e:
        print(f"Error parsing file {file_name}: {e}")
        return {}

print(f"[DEBUG] 샘플 키 5개: {list(txt_apply_links.keys())[:5]}")
for i, (k, v) in enumerate(txt_apply_links.items()):
    print(f"[DEBUG] 정책명: '{k}' → 링크: '{v}'")
    if i >= 2:
        break

def find_best_matching_link(policy_name: str) -> str:
    # 1. Exact or clean match
    clean_name = re.sub(r"^\([^)]+\)\s*", "", policy_name).strip()
    if policy_name in txt_apply_links:
        print(f"[DEBUG] Exact match found: '{policy_name}' -> '{txt_apply_links[policy_name]}'")
        return txt_apply_links[policy_name]
    if clean_name in txt_apply_links:
        print(f"[DEBUG] Clean exact match found: '{policy_name}' -> '{txt_apply_links[clean_name]}'")
        return txt_apply_links[clean_name]
        
    print(f"[DEBUG] Match failed for: '{policy_name}'")
    return "unknown"

def get_cached_policy_links(policy_name: str) -> tuple:
    # 1. 메모리에 로딩된 일반링크가 있는가? (퍼지 매칭 적용)
    apply_link = find_best_matching_link(policy_name)
    
    # 2. 캐시 메모리에서 cached detail_link를 확인
    clean_name = re.sub(r"^\([^)]+\)\s*", "", policy_name).strip()
    detail_link = "unknown"
    cached_info = policy_links_cache.get(policy_name) or policy_links_cache.get(clean_name)
    if cached_info:
        if apply_link == "unknown":
            apply_link = cached_info.get("apply_link", "unknown")
        detail_link = cached_info.get("detail_link", "unknown")
    return apply_link, detail_link

def get_cached_detail_link(policy_name: str) -> str:
    _, detail_link = get_cached_policy_links(policy_name)
    return detail_link

def resolve_single_policy_detail_link(policy_name: str, apply_link: str, eligibility: str) -> str:
    links_path = os.path.join(os.path.dirname(__file__), "policy_links.json")
    clean_name = re.sub(r"^\([^)]+\)\s*", "", policy_name).strip()
    
    # 0. apply_link가 없거나 unknown이면 로컬 캐시에서 lookup하여 보정
    if not apply_link or apply_link == "unknown":
        apply_link = txt_apply_links.get(policy_name) or txt_apply_links.get(clean_name) or "unknown"

    # 1. 캐시 히트(Cache Hit) 시 즉시 반환 (속도 0ms)
    cached_info = policy_links_cache.get(policy_name) or policy_links_cache.get(clean_name)
    if cached_info and cached_info.get("detail_link") and cached_info.get("detail_link") != "unknown":
        print(f"[RealtimeResolver] Cache Hit for {policy_name} -> {cached_info['detail_link']}")
        return cached_info["detail_link"]
        
    # 2. 캐시 미스(Cache Miss) 시 상세내용 본문에서 신청 메인 URL 추출
    # 만약 기존 apply_link가 이미 상세링크라면 크롤링하지 않고 즉시 반환
    if not is_base_link(apply_link):
        print(f"[RealtimeResolver] Link '{apply_link}' is already a detailed URL. Skipping crawl.")
        return apply_link
        
    # 3. Selenium 헤드리스 브라우징 동적 탐색 시도 (정부24 플러스 서비스 혜택찾기 전용 크롤러)
    print(f"[RealtimeResolver] Crawling Gov24 Plus for detailed page of '{policy_name}'...")
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--window-size=1200,800")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    
    detail_link = apply_link if apply_link and apply_link != "unknown" else "unknown"
    driver = None
    try:
        driver = webdriver.Chrome(options=options)
        driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
            "source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        })
        
        # 1. 정부24 혜택 목록 페이지 접속
        driver.get("https://plus.gov.kr/portal/benefitV2/benefitTotalSrvcList/")
        time.sleep(3)
        
        # 2. 검색창 찾기 (보이는 엘리먼트 타겟팅)
        inputs = driver.find_elements(By.CSS_SELECTOR, "input[placeholder*='검색어를 입력해주세요.']")
        search_input = None
        for ip in inputs:
            if ip.is_displayed():
                search_input = ip
                break
        if not search_input:
            inputs2 = driver.find_elements(By.CSS_SELECTOR, "input[title='검색어 입력']")
            for ip in inputs2:
                if ip.is_displayed():
                    search_input = ip
                    break
                    
        if search_input:
            # 3. 검색어 입력 및 돋보기 버튼 클릭
            search_input.clear()
            search_input.send_keys(clean_name)
            time.sleep(1)
            
            buttons = driver.find_elements(By.CSS_SELECTOR, "button.btn-total-search")
            search_btn = None
            for btn in buttons:
                if btn.is_displayed():
                    search_btn = btn
                    break
                    
            if search_btn:
                search_btn.click()
                time.sleep(4)
                
                # 4. 검색결과 개수 판별
                uls = driver.find_elements(By.CSS_SELECTOR, "ul.list")
                result_lis = []
                for ul in uls:
                    lis = ul.find_elements(By.XPATH, "./li")
                    if len(lis) > 0:
                        wraps = ul.find_elements(By.CSS_SELECTOR, ".card-wrap")
                        if len(wraps) > 0:
                            result_lis = lis
                            break
                
                if len(result_lis) == 1:
                    # 5-1. 검색결과가 딱 하나 나옴 -> 클릭하여 상세페이지 주소 추출
                    click_target = result_lis[0].find_element(By.CSS_SELECTOR, "a.info-area")
                    driver.execute_script("arguments[0].click();", click_target)
                    time.sleep(4)
                    detail_link = driver.current_url
                    print(f"[RealtimeResolver] Resolved single result: {policy_name} -> {detail_link}")
                elif len(result_lis) > 1:
                    # 5-2. 검색결과가 하나 이상 나옴 -> 현 상태 주소 그대로
                    detail_link = driver.current_url
                    print(f"[RealtimeResolver] Multiple results found for {policy_name}. Using list URL: {detail_link}")
                else:
                    print(f"[RealtimeResolver] No search results on Gov24 for {policy_name}.")
            else:
                print(f"[RealtimeResolver] Search button not found.")
        else:
            print(f"[RealtimeResolver] Search input not found.")
            
    except Exception as e:
        print(f"[RealtimeResolver] Gov24 Plus Crawling failed for {policy_name}: {e}")
    finally:
        if driver:
            driver.quit()
            
    # 4. 수집 완료된 결과 캐시에 갱신 보관
    policy_links_cache[policy_name] = {
        "apply_link": apply_link,
        "detail_link": detail_link
    }
    policy_links_cache[clean_name] = {
        "apply_link": apply_link,
        "detail_link": detail_link
    }
    if apply_link and apply_link != "unknown":
        txt_apply_links[policy_name] = apply_link
        txt_apply_links[clean_name] = apply_link
        
    try:
        with open(links_path, "w", encoding="utf-8") as f:
            json.dump(policy_links_cache, f, ensure_ascii=False, indent=2)
    except Exception:
        pass
        
    return detail_link

# 자바의 PolicyResponseDTO와 똑같은 구조로 AI가 답변하도록 규격 정의
class PolicyResponseModel(BaseModel):
    policy_name: str
    apply_link: str
    detail_link: str = "unknown"   # 상세 신청 페이지 URL
    apply_method: str              # AI가 본문에서 추출할 신청 방법 요약 (예: 온라인 접수, 주소 등)
    reason: str
    eligibility: str
    region: str
    education: str
    job: str
    housing: str
    housingDetail: str
    income: str
    interest: str
    special: List[str]
    required_documents: List[str]   # AI가 본문에서 추출할 구비 서류 목록
    end_date: str                   # AI가 본문에서 추출할 신청 마감일 (YYYY-MM-DD 또는 unknown)
    match_rate: int                 # 사용자 조건과의 추천 부합도/정확도 (0~100)
    agency: str = "정보 없음"       # 소관/신청 기관


# AI가 조건 불일치로 탈락시킨 정책 정보 (나이/마감 제외)
class FilteredOutPolicyModel(BaseModel):
    policy_name: str
    reject_reason: str              # 탈락 사유 (예: "소득 조건 불일치", "학적 요건 미충족")

class MatchResultModel(BaseModel):
    policies: List[PolicyResponseModel]
    filtered_out: List[FilteredOutPolicyModel]  # 조건 불가로 탈락된 정책 (나이/마감 제외)

# Pydantic 모델로 구조화된 출력 강제
structured_llm = llm.with_structured_output(MatchResultModel)

# [3] 로컬 ChromaDB 설정 (embed_policies.py와 동일한 모델 사용 필수!)
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
chromaDB_PATH = os.path.join(os.path.dirname(__file__), "chromaDB")
embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
vectorstore = Chroma(
    persist_directory=chromaDB_PATH,
    embedding_function=embeddings,
    collection_name="gwangju_policies"
)

# 자바의 UserRequestDTO와 필드명, 개수(10개)를 1:1로 정확하게 일치
class UserRequestModel(BaseModel):
    region: str
    education: str
    job: str
    housing: str
    housingDetail: str
    income: str
    interest: str
    special: List[str]
    birthDate: str
    manAge: int

class ResolveLinkModel(BaseModel):
    policy_name: str
    apply_link: str
    eligibility: str

@app.post("/resolve-link")
async def resolve_link(p: ResolveLinkModel):
    apply_link = p.apply_link
    if not apply_link or apply_link == "unknown":
        apply_link = find_best_matching_link(p.policy_name)
        
    detail_link = resolve_single_policy_detail_link(p.policy_name, apply_link, p.eligibility)
    if detail_link == "unknown" and apply_link and apply_link != "unknown":
        detail_link = apply_link
    return {"policy_name": p.policy_name, "apply_link": apply_link, "detail_link": detail_link}

@app.post("/match")
async def match_policies(p: UserRequestModel):
    import datetime
    today_str = datetime.date.today().isoformat()

    # 1. 벡터스토어 검색어 최적화: 
    # 검색의 편향을 막기 위해 '관심사(interest)'는 벡터 검색어에서 제외합니다. (관심사는 하드 필터링이 아닌 AI 가중치용)
    # 또한 사용자가 광주에 거주하더라도 '전국' 단위 정책도 조회되어야 하므로 핵심 조건 위주로 검색어를 구성합니다.
    search_terms = f"{p.region} 전국 {p.education} {p.job} {p.housing} {p.housingDetail} {p.income} {' '.join(p.special)}"

    # ChromaDB에서 관련 정책 후보 80개 대량 검색 (Gemini 2.5 Flash는 대용량 컨텍스트 처리가 가능함)
    relevant_docs = vectorstore.similarity_search(search_terms, k=80)
    
    # 💡 [1차 필터링 - RAG 단계] 마감된 정책의 청크는 프롬프트 컨텍스트에서 아예 배제
    active_docs = []
    excluded_titles = set()
    for doc in relevant_docs:
        # Title check from first line of chunk
        first_line = doc.page_content.split('\n')[0]
        title_match = re.search(r"정책제목:\s*(.*)", first_line)
        title = title_match.group(1).strip() if title_match else None
        
        # Source file check from metadata
        source_path = doc.metadata.get("source", "")
        file_name = os.path.basename(source_path)
        
        policy_name_to_check = title
        if not policy_name_to_check and file_name.endswith(".txt"):
            policy_name_to_check = os.path.splitext(file_name)[0]
            
        is_expired = False
        if policy_name_to_check:
            clean_check_name = re.sub(r"^\([^)]+\)\s*", "", policy_name_to_check).strip()
            deadline = txt_policy_deadlines.get(policy_name_to_check) or txt_policy_deadlines.get(clean_check_name)
            if deadline and is_policy_expired(deadline):
                is_expired = True
                excluded_titles.add(policy_name_to_check)
                
        if not is_expired:
            active_docs.append(doc)
            
    print(f"[RAG Filter] Excluded {len(relevant_docs) - len(active_docs)} chunks belonging to expired policies: {list(excluded_titles)}")
    context = "\n\n".join([doc.page_content for doc in active_docs])

    # 2. 프롬프트 엔지니어링
    prompt = f"""
    당신은 대한민국 및 광주 청년 정책 전문가입니다. 아래 사용자 조건과 참고 공고문을 정밀 대조하여 가장 알맞은 정책 추천 리스트를 반환하세요.
    
    [오늘 날짜]
    - {today_str}
    
    [사용자 입력 조건]
    - 지역: {p.region} (참고: 전국 단위 정책은 지역에 무관하게 매칭 가능합니다)
    - 생년월일: {p.birthDate}
    - 만 나이: 만 {p.manAge}세 (중요: 이 만 나이 수치와 정책 공고문 내 연령 제한 요건을 1:1로 정밀 비교하세요.)
    - 학적: {p.education}
    - 취업: {p.job}
    - 주거: {p.housing}, 주거상세: {p.housingDetail}, 소득: {p.income}
    - 주요 관심분야(정렬 가중치용): {p.interest} (중요: 관심 분야는 추천 정렬 우선순위를 높이기 위한 가중치 항목일 뿐이며, 관심 분야가 다른 정책이라도 자격 요건에 부합하면 무조건 추천에 포함시키세요.)
    - 특수사항: {", ".join(p.special)}
    
    [참고 공고문 데이터]
    {context}
    
    [미션 및 출력 규칙]
    1. 참고 공고문 중에서 사용자의 조건과 조금이라도 부합하는 정책들을 최대한 누락 없이 골라 매칭하세요. 결과 개수가 너무 적지 않도록 자격 요건이 충족되면 적극적으로 포함하여 최소 8~12개 내외의 풍부한 정책 리스트를 반환하세요.
    1-2. 중요 (지역 조건 불일치의 엄격한 필터링):
         - 사용자의 거주 지역(지역: {p.region}, 예: "광주광역시 북구", "광주광역시 전체")과 참고 공고문의 대상 지역, 지원 지역, 또는 소관 기관(예: "인천광역시 관내", "인천도시공사", "부산시 수영구" 등)을 반드시 정밀 대조하십시오.
         - 만약 공고문 텍스트 내에 특정 타 지자체 제한(예: 인천, 대구, 부산, 경기도 등 사용자의 지역과 다른 광역/기초 자치단체)이 명시되어 있는 정책이라면, 이는 사용자 자격 조건에 부합하지 않으므로 추천 목록(policies)에서 **무조건 완전히 제외**하고, 필터링 탈락 목록(filtered_out)에 반드시 포함시키십시오. (탈락 사유 예: "지역 제한 불일치: 인천광역시 청년만 지원 가능")
         - 단, 지역 조건이 '전국', '전국 단위', '정부', '부처' 등으로 특별히 지역 제한이 없는 공고이거나, 사용자의 실제 거주지(예: 광주광역시)와 일치하는 지자체 공고인 경우에만 추천에 포함할 수 있습니다.
    1-3. 중요 (정책 이름 환각 방지 및 일치):
         - 정책 이름(policy_name)은 반드시 참고 공고문 데이터의 "정책제목:"에 적힌 명칭과 한 글자도 다르지 않게 정확하게 동일하게 출력하십시오. 임의로 이름을 변경하거나, 다른 이름을 만들어내거나, 단어를 추가/삭제하지 마십시오.
    2. 부합하는 정책의 정보들을 매칭하여 리스트 형식으로 반환해야 합니다.
    3. 중요: 만약 공고문 텍스트 내에 특정 조건이 명시되어 있지 않다면, 해당 항목의 값은 무조건 "unknown"으로 채워넣으세요.
    4. 추천 사유(reason)는 사용자의 현재 상황을 언급하며 이 정책이 왜 매칭되었는지 친절한 사유를 한글로 작성하되, 반드시 2~3줄 이내로 극도로 짧고 간결하게 작성하고, 매칭되는 핵심 키워드는 **반드시** `**키워드**` 형태의 마크다운 굵은 글씨로 감싸서 출력되도록 하세요.
    5. 중요 (공식 링크 최우선 추출):
       - 공고문 데이터의 "접수기관" 혹은 "신청방법" 텍스트 섹션 내에 기재된 공식 웹사이트 URL(예: http://myhome.go.kr 등)이 덜렁 기재되어 있거나 언급된 경우, 이를 최우선으로 찾아내어 apply_link 필드에 반드시 기입하세요.
       - 만약 텍스트 내에 전혀 연관 사이트 주소가 없다면 "unknown"으로 작성하세요.
    5-2. 중요 (신청방법 상세 요약):
       - 공고문 데이터의 "신청방법", "접수방법", "문의처", "접수기관" 등 신청 절차나 방법에 관한 정보를 2~3줄 내외로 한국어로 친절하게 요약하여 apply_method 필드에 반드시 기입하십시오. (예: "온라인 접수 (홈페이지 신청서 작성 및 PDF 스캔본 업로드), 문의: 041-635-1270")
       - 만약 본문에 신청 방법이나 연락처가 전혀 기재되어 있지 않다면 "정보 없음"으로 표기하십시오.
    6. 공고문 데이터에서 제출이 필요한 모든 서류 목록을 정확히 파악하여 required_documents 필드에 배열 형태로 넣으세요. (예: ["주민등록등본", "가족관계증명서"])
    10. 중요 (조건 불가 정책의 별도 분류 및 마감 격리 규칙):
         - 공고문에 명시된 마감일(end_date)이 오늘 날짜({today_str})보다 이전인 정책(이미 신청 기간이 마감된 정책)은 사용자의 자격 요건 충족 여부와 관계없이 추천 정책 목록(policies) 및 탈락 목록(filtered_out) 양쪽 모두에서 **100% 완전히 제외**하십시오.
         - 위의 추천 리스트(policies)에 포함시키지 않은 정책들 중에서, **나이 초과/미달 또는 마감기한 초과**로 인해 탈락된 정책은 아예 보고하지 마세요 (완전히 제외).
         - 그러나, **나이와 마감기한 이외의 기타 조건**(학적, 소득, 취업상태, 주거, 지역 제한, 특수사항 등)으로 인해 탈락시킨 정책은 반드시 filtered_out 리스트에 포함하세요.
         - filtered_out의 각 항목에는 policy_name(정책 이름)과 reject_reason(탈락 사유, 예: "소득 기준 미충족: 중위소득 50% 이하 필요", "학적 조건 불일치: 대학 재학생만 가능")을 간결하게 적어주세요.
         - 이 목록은 사용자가 AI의 오분류를 직접 확인하기 위한 용도이므로, 가능한 한 빠짐없이 기록해 주세요.
    """

    # Gemini 실행 후 구조화된 결과 반환 (추천 + 탈락 정책 모두 포함)
    try:
        result = structured_llm.invoke(prompt)
    except Exception as e:
        print(f"[Gemini Exception] Error invoking LLM matching: {e}. Activating fallback rule-based matching.")
        
        fallback_policies = []
        unique_policies = {}
        
        # active_docs는 이미 마감 기한 필터링이 완료된 활성 정책 문서 청크들입니다.
        for doc in active_docs:
            first_line = doc.page_content.split('\n')[0]
            title_match = re.search(r"정책제목:\s*(.*)", first_line)
            title = title_match.group(1).strip() if title_match else None
            
            source_path = doc.metadata.get("source", "")
            file_name = os.path.basename(source_path)
            policy_name = title
            if not policy_name and file_name.endswith(".txt"):
                policy_name = os.path.splitext(file_name)[0]
                
            if policy_name and policy_name not in unique_policies:
                unique_policies[policy_name] = doc
                
        # 매칭 추천 결과 개수가 풍부하도록 최대 10개까지 로컬 추천 생성
        candidate_names = list(unique_policies.keys())[:10]
        
        for name in candidate_names:
            doc = unique_policies[name]
            clean_name = re.sub(r"^\([^)]+\)\s*", "", name).strip()
            file_name = policy_file_map.get(name) or policy_file_map.get(clean_name)
            
            details = {}
            if file_name:
                details = extract_ground_truth_policy_details(file_name)
            
            # 카테고리 판정 및 유저 관심사 일치 시 높은 매칭률 부여
            policy_interest = details.get("interest", clean_category(doc.metadata.get("category", "주거")))
            is_preferred = (policy_interest == p.interest)
            match_rate = 92 if is_preferred else 78
            
            reason = f"귀하의 주요 관심 분야인 `**{p.interest}**` 및 `{p.region}` 거주 요건에 부합하는 정책으로 판단되어 RAG 시스템에 의해 **맞춤 추천**되었습니다."
            
            p_model = PolicyResponseModel(
                policy_name=name,
                apply_link=details.get("apply_link", "unknown"),
                detail_link=get_cached_detail_link(name),
                apply_method=details.get("apply_method", "정보 없음"),
                reason=reason,
                eligibility=details.get("eligibility", doc.page_content[:250]),
                region=details.get("region", p.region),
                education=details.get("education", p.education),
                job=details.get("job", p.job),
                housing=details.get("housing", p.housing),
                housingDetail=details.get("housingDetail", p.housingDetail),
                income=details.get("income", p.income),
                interest=policy_interest,
                special=p.special if p.special else ["해당없음"],
                required_documents=details.get("required_documents", ["주민등록등본"]),
                end_date=details.get("end_date", "unknown"),
                match_rate=match_rate,
                agency=details.get("agency", "정보 없음")
            )
            
            # 캐시된 링크 매핑 보강
            cached_apply_link, cached_detail_link = get_cached_policy_links(name)
            if cached_detail_link and cached_detail_link != "unknown":
                p_model.detail_link = cached_detail_link
            if cached_apply_link and cached_apply_link != "unknown":
                p_model.apply_link = cached_apply_link
                
            p_model.interest = clean_category(p_model.interest)
            fallback_policies.append(p_model)
            
        print(f"[Fallback Match] Successfully generated {len(fallback_policies)} matched policies rule-based fallback.")
        return {"policies": fallback_policies, "filtered_out": []}

    
    # 💡 [2차 필터링 - 포스트 LLM 단계] 결과 반환 전에 프로그램적으로 마감 정책 한 번 더 필터링 (동작 보장)
    active_policies = []
    for policy in result.policies:
        name = policy.policy_name
        
        # 1. 환각 방지를 위한 타이틀 정밀 매핑 (SequenceMatcher 활용)
        best_match, ratio = find_best_policy_title_match(name)
        if best_match and ratio >= 0.50:
            policy.policy_name = best_match
            name = best_match
        else:
            print(f"[Post-LLM Alignment] Discarded completely hallucinated policy: '{name}' (Max similarity ratio: {ratio:.2f})")
            continue
            
        # 2. 원본 텍스트 파일로부터 실제 메타데이터 추출 (환각 차단용 선제 로딩)
        file_name = policy_file_map.get(name)
        details = {}
        if file_name:
            details = extract_ground_truth_policy_details(file_name)
            if details:
                policy.policy_name = details.get('policy_name', name)
                policy.interest    = details.get('interest', policy.interest)
                policy.agency      = details.get('agency', policy.agency)
                policy.apply_method       = details.get('apply_method', policy.apply_method)
                policy.required_documents = details.get('required_documents', policy.required_documents)
                policy.end_date    = details.get('end_date', policy.end_date)
                policy.eligibility = details.get('eligibility', policy.eligibility)
                if details.get('apply_link') and details.get('apply_link') != 'unknown':
                    policy.apply_link = details['apply_link']

        # ── 검사 텍스트 구성 ──
        policy_text = details.get('condition_text') or (name + " " + details.get('agency', '') + " " + details.get('eligibility', ''))
        special_check_text = policy_text  # 동일 텍스트 재사용

        # 지역 필터
        if is_region_mismatched(policy_text, p.region):
            print(f"[Post-LLM Filter] 지역 불일치 제외: '{name}' / 사용자 지역: '{p.region}'")
            continue

        # special 필터
        if is_special_mismatched(special_check_text, p.special):
            print(f"[Post-LLM Filter] 특수조건 불일치 제외: '{name}'")
            continue
        
        # 3. 카테고리(interest) 정보 강제 검증/클렌징
        policy.interest = clean_category(policy.interest)
        
        # 4. 마감 기한 정밀 체크
        if is_policy_expired(policy.end_date):
            print(f"[Post-LLM Filter] Excluded recommended expired policy: '{name}' (deadline: {policy.end_date})")
            continue
            
        cached_apply_link, cached_detail_link = get_cached_policy_links(name)
        
        # 5) 일반 신청링크 복원/주입 (우선적으로 캐시나 txt 파일에서 정밀 복원)
        if cached_apply_link != "unknown":
            policy.apply_link = cached_apply_link
        elif policy.apply_link == "unknown" or not policy.apply_link.startswith("http"):
            if cached_detail_link != "unknown":
                policy.apply_link = cached_detail_link
                
        # 6) 상세 신청링크 복원/주입
        if cached_detail_link != "unknown":
            policy.detail_link = cached_detail_link
        else:
            policy.detail_link = "unknown"
            
        active_policies.append(policy)
        
    active_filtered_out = []
    for f_policy in result.filtered_out:
        name = f_policy.policy_name
        
        # 동일하게 타이틀 매핑
        best_match, ratio = find_best_policy_title_match(name)
        if best_match and ratio >= 0.50:
            f_policy.policy_name = best_match
            name = best_match
        else:
            print(f"[Post-LLM Alignment] Discarded hallucinated filtered-out policy: '{name}' (Max similarity ratio: {ratio:.2f})")
            continue
            
        # 원본 파일 조회
        file_name = policy_file_map.get(name)
        file_deadline = "unknown"
        details = {}
        if file_name:
            details = extract_ground_truth_policy_details(file_name)
            if details:
                file_deadline = details.get('end_date', 'unknown')
        else:
            clean_name = re.sub(r"^\([^)]+\)\s*", "", name).strip()
            file_deadline = txt_policy_deadlines.get(name) or txt_policy_deadlines.get(clean_name) or "unknown"

        if is_policy_expired(file_deadline):
            print(f"[Post-LLM Filter] Excluded filtered-out expired policy: '{name}'")
            continue

        # ── 검사 텍스트 구성 ──
        filter_text = details.get('condition_text') or name

        # 지역 필터
        if is_region_mismatched(filter_text, p.region):
            print(f"[Post-LLM Filter] 지역 불일치 탈락 제외: '{name}'")
            continue

        # special 필터
        if is_special_mismatched(filter_text, p.special):
            print(f"[Post-LLM Filter] 특수조건 불일치 탈락 제외: '{name}'")
            continue
        active_filtered_out.append(f_policy)
        
    return {"policies": active_policies, "filtered_out": active_filtered_out}


# 챗봇 요청 규격
class ChatMessageModel(BaseModel):
    sender: str
    text: str

class ChatRequestModel(BaseModel):
    query: str
    username: str
    region: str = "unknown"
    education: str = "unknown"
    job: str = "unknown"
    housing: str = "unknown"
    housingDetail: str = "unknown"
    income: str = "unknown"
    special: List[str] = []
    manAge: int = 25
    policyContext: Optional[str] = None
    history: List[ChatMessageModel] = []

# 챗봇 응답 규격
class ChatResponseModel(BaseModel):
    answer: str

# 💬 AI 개인화 환각방지 챗봇 API
@app.post("/chat", response_model=ChatResponseModel)
async def chat_with_bot(p: ChatRequestModel):
    # ChromaDB에서 유저 질문 관련 정보(k=5) 유사도 검색하여 RAG 컨텍스트 획득
    relevant_docs = vectorstore.similarity_search(p.query, k=5)
    context = "\n\n".join([doc.page_content for doc in relevant_docs])
    
    # 만약 특정 공고 context가 프론트엔드로부터 넘어온 경우 (드래그 질문이나 특정 공고 1:1 질문)
    dragged_policy_info = ""
    if p.policyContext:
        dragged_policy_info = f"""
    [중요: 사용자가 질문한 대상 공고 상세 정보 (가장 최우선으로 참고하여 답변할 것)]
    {p.policyContext}
    """

    # 이전 대화 기록 포맷팅
    chat_history_str = ""
    if p.history:
        history_lines = []
        for msg in p.history[-10:]:  # 최근 10개 메시지로 컨텍스트 최적화
            role = "사용자" if msg.sender == "user" else "AI 비서"
            history_lines.append(f"{role}: {msg.text}")
        chat_history_str = "\n".join(history_lines)

    prompt = f"""
    당신은 청년 정책 및 공공 행정 지식 전문가인 'Gov24 Plus AI 비서'입니다.
    이전 대화 기록과 사용자의 현재 상황 맥락을 바탕으로 자연스럽게 이어지는 답변을 제공하십시오.

    [이전 대화 기록 (맥락 유지용)]
    {chat_history_str if chat_history_str else "이전 대화 없음"}

    [사용자 질문 (이 질문에 대해 명확하게 답변할 것)]
    - {p.query}

    [핵심 지침: 두괄식 및 극도의 간결함]
    1. 답변은 반드시 **핵심 답변이 맨 처음에 오도록 두괄식**으로 작성하십시오. 서론이나 형식적인 인사말, 혹은 질문자가 질문한 드래그 문장을 그대로 복창하거나 프롬프트 조건("RAG에 따르면" 등)을 언급하지 마십시오.
    2. 모든 답변은 가독성이 뛰어나야 하며, 최대 **3~4문장 이내**로 대답하는 것을 원칙으로 합니다. (상세 서류나 요건이 있는 경우에만 요약형 글머리표로 간결하게 나열하십시오.)
    3. **대화 맥락 유지**: 사용자의 질문이 이전 대화의 흐름이나 언급된 상황에 이어진다면, `[이전 대화 기록]`을 적극 활용하여 사용자가 대화 맥락 속에서 연속된 답변을 받도록 처리하십시오. (예: 사용자가 앞서 본인이 처한 조건들을 이야기했다면, 그 조건을 기억하여 다른 정책과의 매칭 가능 여부에 자연스럽게 대입해 주십시오.)

    {dragged_policy_info}

    [사용자 현재 프로필 정보]
    - 지역: {p.region}
    - 만 나이: 만 {p.manAge}세
    - 학적: {p.education}
    - 근로/취업: {p.job}
    - 주거: {p.housing} ({p.housingDetail})
    - 소득 구간: {p.income}
    - 특수 우대 사항: {", ".join(p.special) if p.special else "없음"}
    
    [RAG 참고 지식 (ChromaDB 추출)]
    {context}
    
    [행정/공공 지식 필수 지침 (환각 방지)]
    1. 소득분위 및 소득 판정:
       - 아르바이트(알바) 소득도 세법상 '근로소득' 또는 '사업소득(3.3% 원천징수)'에 해당하며 가구 및 본인의 공식 소득으로 집계됩니다. 단, 정책마다 청년 본인 소득만 보는지, 부모 합산 소득을 보는지 기준이 다릅니다.
       - 용돈은 비과세 사적이전재산 성격으로 세무서에 근로소득 등으로 신고되지 않아 공식적인 '근로/사업/재산소득' 지표에는 산정되지 않습니다. 단, 알바를 하지 않고 용돈만 받는다면 근로소득 지표는 0원입니다.
       - 주거가 분리되어 독립 가구로 되어 있고 알바 소득이 없어 무소득 상태라 하더라도, 부모가 충분한 소득이 있다면 무조건 취약계층(기초수급자 등)으로 판정되지는 않습니다. 기초생활보장 수급자 선정 시에는 부양의무자(부모)의 소득 및 재산 기준을 함께 조회하기 때문입니다.
    2. 공공 서류 발급 안내:
       - 가족관계증명서, 주민등록등본/초본 등은 인터넷 사이트 '정부24(gov.kr)'에서 본인인증(공동인증서, 간편인증 등) 후 무료로 온라인 즉시 발급/출력할 수 있습니다. 가까운 동 주민센터나 지하철역 무인민원발급기에서도 유료로 발급 가능합니다.
       - 소득을 증명하는 '소득금액증명원'은 국세청 홈택스(hometax.go.kr) 또는 정부24에서 온라인 무료 발급이 가능합니다.
    3. 학적 증명서 차이점:
       - '재적증명서'는 현재 해당 학교에 학적(재학, 휴학, 제적 등)이 존재하고 있거나 존재했었음을 증명하는 서류로, 재학생과 휴학생 모두 발급받을 수 있습니다.
       - '졸업증명서'는 모든 졸업 요건 및 학위 수여가 완료되어 정식 졸업했음을 증명하는 서류입니다. 재학생/휴학생은 졸업증명서를 발급받을 수 없으며 재학증명서나 수료증명서를 발급받아야 합니다.
    
    [답변 규칙]
    - 반드시 한국어로 친절하고 정중하며 신뢰감 있는 경어체(존댓말)로 답변하십시오.
    - [질문 대상 공고 상세 정보]나 [RAG 참고 지식] 또는 공공 지식 지침에 명확한 정보가 없고 일반 Gemini의 상식에도 불투명한 행정 내용이라면 무리하게 답변을 꾸며내지 말고, "해당 내용은 공식 지침서상 파악이 어려워, 정확한 확인을 위해 관할 기관(동 주민센터, 정부24 고객센터, 복지로 등)에 직접 교차 확인해 보시는 것을 권장드립니다."라고 안내하여 환각을 차단하십시오.
    - 마크다운 구조(굵은 글씨, 목록형 표기 등)를 적극 사용해 가독성을 기여하십시오.
    """
    
    # Gemini AI 작동
    try:
        response = llm.invoke(prompt)
        answer = response.content
    except Exception as e:
        print(f"[Gemini Chat Exception] Quota/API Error: {e}. Activating fallback chatbot response.")
        query_lower = p.query.lower()
        if "서류" in query_lower:
            answer = "현재 AI 서버 일시적 과부하로 인하여 로컬 지침을 안내해 드립니다. 가족관계증명서, 주민등록등본 등은 **정부24(gov.kr)**에서 무료로 즉시 발급 가능하며, 소득 증명 서류는 **국세청 홈택스**에서 무료로 발급받으실 수 있습니다."
        elif "소득" in query_lower:
            answer = f"현재 고객님의 프로필 소득 조건은 **{p.income}**입니다. 알바 소득도 세법상 근로소득에 해당하나, 정책별로 본인 소득만 기준인지 혹은 가구 합산(부모 소득)인지 다를 수 있으니 상세 요건을 재확인하시기 바랍니다."
        elif "나이" in query_lower:
            answer = f"현재 고객님의 계산된 생년월일 기준 나이는 **만 {p.manAge}세**입니다. 대부분의 청년/지원 정책은 만 19세~39세를 주 대상으로 설계되어 있습니다."
        else:
            answer = "안녕하세요! 현재 AI 서버 부하로 인해 실시간 상세 분석 답변이 임시 지연되고 있습니다. 관심 있으신 정책 공고를 저장(관심 등록)해 두시거나, 상세 페이지를 확인해 주시면 대단히 감사하겠습니다."
            
    return ChatResponseModel(answer=answer)



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
