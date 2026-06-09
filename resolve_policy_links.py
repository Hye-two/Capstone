# -*- coding: utf-8 -*-
import sys
import os
import re
import json
import time
import calendar
from datetime import date
from urllib.parse import urlparse
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.keys import Keys

# UTF-8 출력 강제 (윈도우 콘솔 에러 방지)
sys.stdout.reconfigure(encoding='utf-8')

# main.py 와 일관성을 맞추기 위한 로컬 헬퍼 함수 정의
def parse_last_date(cleaned: str):
    parts = re.split(r'~| - |(?<=\d)-(?=\d)', cleaned)
    target_part = parts[-1].strip() if parts else cleaned
    
    numbers = [int(x) for x in re.findall(r'\d+', target_part)]
    
    if len(numbers) >= 3:
        try:
            year, month, day = numbers[0], numbers[1], numbers[2]
            if year < 100:
                year += 2000
            return date(year, month, day)
        except ValueError:
            pass
            
    if len(numbers) == 2:
        first_part_numbers = [int(x) for x in re.findall(r'\d+', parts[0])]
        if first_part_numbers:
            year = first_part_numbers[0]
            if year > 1000:
                if year < 100:
                    year += 2000
                try:
                    month, day = numbers[0], numbers[1]
                    return date(year, month, day)
                except ValueError:
                    pass
        y, m = numbers[0], numbers[1]
        if y > 1000:
            if y < 100:
                y += 2000
            try:
                last_day = calendar.monthrange(y, m)[1]
                return date(y, m, last_day)
            except ValueError:
                pass
                    
    all_numbers = [int(x) for x in re.findall(r'\d+', cleaned)]
    if len(all_numbers) >= 6:
        try:
            y2, m2, d2 = all_numbers[3], all_numbers[4], all_numbers[5]
            if y2 < 100:
                y2 += 2000
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
        return last_date < date.today()
        
    return False

def is_base_link(url: str) -> bool:
    if not url or url == "unknown":
        return True
    try:
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

policy_dir = "policy_details"
files = [f for f in os.listdir(policy_dir) if f.endswith(".txt")]

print(f"[LinkResolver] Total policy files found: {len(files)}")

# 1. JSON 결과 로드 또는 초기화
output_file = "policy_links.json"
resolved_links = {}
if os.path.exists(output_file):
    try:
        with open(output_file, "r", encoding="utf-8") as f:
            resolved_links = json.load(f)
        print(f"[LinkResolver] Loaded {len(resolved_links)} existing links from {output_file}")
    except Exception as e:
        print(f"[LinkResolver] Error loading {output_file}: {e}")

# 2. 텍스트 파싱을 통해 마감 기한 필터링 및 타겟 분류
policies_data = {}
expired_skipped = 0

for file in files:
    path = os.path.join(policy_dir, file)
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # 정책제목 추출
    title_match = re.search(r"정책제목:\s*(.*)", content)
    title = title_match.group(1).strip() if title_match else os.path.splitext(file)[0]
    
    # 마감기한 추출
    end_date_match = re.search(r"(?:신청 기한|신청기한|신청 기간|신청기간):\s*(.*)", content)
    end_date = end_date_match.group(1).strip() if end_date_match else "unknown"
    if end_date == "unknown" or end_date == "":
        detail_match = re.search(r"신청기간\s*\n\s*(마감|상시|.*)", content)
        if detail_match:
            end_date = detail_match.group(1).strip()
            
    # 마감 표시된 정책 제외
    if is_policy_expired(end_date):
        expired_skipped += 1
        continue
        
    # 일반 링크 추출
    link_match = re.search(r"링크:\s*(.*)", content)
    apply_link = link_match.group(1).strip() if link_match else "unknown"
    if not apply_link:
        apply_link = "unknown"
        
    clean_name = re.sub(r"^\([^)]+\)\s*", "", title).strip()
    
    policies_data[title] = {
        "apply_link": apply_link,
        "clean_name": clean_name,
        "detail_link": "unknown"
    }

print(f"[LinkResolver] Expired policies skipped: {expired_skipped}")
print(f"[LinkResolver] Active policies to process: {len(policies_data)}")

# 3. 셀레니움 탐색 대상 선별 (이미 캐싱된 것은 스킵)
crawling_targets = {}
for title, info in policies_data.items():
    apply_link = info["apply_link"]
    clean_name = info["clean_name"]
    
    # 캐시 히트
    cached_info = resolved_links.get(title) or resolved_links.get(clean_name)
    if cached_info and cached_info.get("detail_link") and cached_info.get("detail_link") != "unknown":
        info["detail_link"] = cached_info["detail_link"]
        resolved_links[title] = {
            "apply_link": apply_link if apply_link != "unknown" else cached_info.get("apply_link", "unknown"),
            "detail_link": cached_info["detail_link"]
        }
        continue
        
    # 이미 상세링크 규격인 경우 크롤링 스킵하고 바로 설정
    if not is_base_link(apply_link):
        info["detail_link"] = apply_link
        resolved_links[title] = {
            "apply_link": apply_link,
            "detail_link": apply_link
        }
        continue
        
    crawling_targets[title] = info

print(f"[LinkResolver] Identified {len(crawling_targets)} targets that require Gov24 Selenium crawling.")

# 셀레니움 설정
options = Options()
options.add_argument("--headless")
options.add_argument("--window-size=1200,800")
options.add_argument("--disable-gpu")
options.add_argument("--disable-blink-features=AutomationControlled")
options.add_experimental_option("excludeSwitches", ["enable-automation"])
options.add_experimental_option('useAutomationExtension', False)

driver = None

def init_driver():
    global driver
    driver = webdriver.Chrome(options=options)
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    })
    print("[LinkResolver] Chrome Headless Driver Initialized.")

# 4. 동적 크롤링 진행
if crawling_targets:
    processed_count = 0
    init_driver()
    try:
        for title, info in crawling_targets.items():
            processed_count += 1
            clean_name = info["clean_name"]
            apply_link = info["apply_link"]
            print(f"[{processed_count}/{len(crawling_targets)}] Crawling Gov24 for: {title} ({clean_name})")
            
            detail_link = apply_link if apply_link and apply_link != "unknown" else "unknown"
            
            try:
                driver.get("https://plus.gov.kr/portal/benefitV2/benefitTotalSrvcList/")
                time.sleep(3)
                
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
                            click_target = result_lis[0].find_element(By.CSS_SELECTOR, "a.info-area")
                            driver.execute_script("arguments[0].click();", click_target)
                            time.sleep(4)
                            detail_link = driver.current_url
                            print(f"    -> Resolved single result: {detail_link}")
                        elif len(result_lis) > 1:
                            detail_link = driver.current_url
                            print(f"    -> Multiple results: {detail_link}")
                        else:
                            print(f"    -> No results found on Gov24.")
                    else:
                        print("    -> Search button not found.")
                else:
                    print("    -> Search input not found.")
            except Exception as e:
                print(f"    -> Crawl error: {e}")
                
            resolved_links[title] = {
                "apply_link": apply_link,
                "detail_link": detail_link
            }
            resolved_links[clean_name] = {
                "apply_link": apply_link,
                "detail_link": detail_link
            }
            
            if processed_count % 5 == 0:
                with open(output_file, "w", encoding="utf-8") as f:
                    json.dump(resolved_links, f, ensure_ascii=False, indent=2)
                print(f"[LinkResolver] Saved progress. Total: {len(resolved_links)} items.")
                
    finally:
        if driver:
            driver.quit()
            print("[LinkResolver] Chrome Driver closed.")

# 5. 활성 상태인 정책 모두 갱신 통합
for title, info in policies_data.items():
    clean_name = info["clean_name"]
    apply_link = info["apply_link"]
    
    if title not in resolved_links:
        resolved_links[title] = {
            "apply_link": apply_link,
            "detail_link": info.get("detail_link", apply_link)
        }
    if clean_name not in resolved_links:
        resolved_links[clean_name] = {
            "apply_link": apply_link,
            "detail_link": info.get("detail_link", apply_link)
        }

# 최종 저장
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(resolved_links, f, ensure_ascii=False, indent=2)

print(f"[LinkResolver] Completed! Total resolved links saved to {output_file}: {len(resolved_links)}")
