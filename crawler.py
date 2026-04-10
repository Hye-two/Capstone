from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
import time

# 브라우저를 자동으로 켜서 사이트에 들어가기
def start_crawling():
    # 1. 크롬 드라이버 자동 설치 및 실행
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service)

    try:
        # 2. 광주 청년 정책 통합 플랫폼 접속
        url = "https://youth.gwangju.go.kr/www"
        driver.get(url)
        
        time.sleep(3)  # 페이지가 다 뜰 때까지 3초 기다리기

        # 3. 현재 화면의 HTML 소스 가져오기
        html = driver.page_source
        soup = BeautifulSoup(html, 'html.parser')

        # 4. 공고 제목 긁어오기
        policies = soup.select('.title') 
        
        print(f"--- 수집된 정책 목록 ({len(policies)}건) ---")
        for idx, policy in enumerate(policies, 1):
            title = policy.get_text(strip=True)
            print(f"{idx}. {title}")

    except Exception as e:
        print(f"에러 발생: {e}")
    
    finally:
        # 5. 작업 끝났으면 브라우저 닫기
        driver.quit()

if __name__ == "__main__":
    start_crawling()