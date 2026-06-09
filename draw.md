# Capstone Presentation Diagram & Visualization Guide (`draw.md`)

이 문서는 발표 PPT 제작을 위한 **시각 자료 배치 가이드** 및 **다이어그램 소스 코드(Mermaid / DBML)** 모음집입니다. 각 다이어그램이 몇 번 슬라이드에 배치되어야 하는지, 어떤 도구(사이트)에서 그려야 하는지, 그리고 즉시 복사하여 사용할 수 있는 코드를 정리했습니다.

---

## ⏱️ 슬라이드별 시각 자료 배치 요약표

| 슬라이드 번호 | 슬라이드 주제 | 배치할 시각 자료 및 다이어그램 | 추천 제작 사이트 |
| :--- | :--- | :--- | :--- |
| **Slide 1** | **Motivation** | 분절된 청년 정책 서비스 실태 인포그래픽 | Figma / PPT 도형 |
| **Slide 2** | **Limitation** | 기존 플랫폼(정부24 등) vs 본 플랫폼 비교 매트릭스 표 | Markdown Table |
| **Slide 3** | **Background** | RAG (검색 증강 생성) 핵심 아키텍처 흐름 | Mermaid / Draw.io |
| **Slide 4** | **Tech Stack** | 프론트엔드 - 백엔드 - AI 엔진 기술 스택 블록다이어그램 | Figma / PPT 도형 |
| **Slide 5** | **Architecture** | **[메인] 전체 시스템 아키텍처 및 흐름도** | Mermaid / Draw.io |
| **Slide 7** | **Evaluation** | 성능 비교 지표 (온보딩 소요 시간 비교 그래프) | Excel / PPT 차트 |
| **Slide 9** | **Trials & Errors** | 크롤링 방식 vs 오프라인 pre-resolution 성능 비교도 | Mermaid / Draw.io |
| **Slide 10** | **Conclusion** | 사용자 정보 기반 맞춤형 원스톱 복지 순환도 | Figma / PPT 도형 |

---

## 1. [Slide 5] 전체 시스템 아키텍처 (System Architecture)
* **목적**: 웹 브라우저, 스프링 부트(Spring Boot), FastAPI AI 엔진, MySQL 데이터베이스가 상호작용하는 전체 구조를 시각화합니다.
* **제작 사이트**: [Draw.io](https://app.diagrams.net/) 또는 [Mermaid Live Editor](https://mermaid.live/)

```mermaid
graph TD
    %% 스타일 정의
    classDef react fill:#61DAFB,stroke:#20232a,stroke-width:2px,color:#000;
    classDef spring fill:#6DB33F,stroke:#2b5722,stroke-width:2px,color:#fff;
    classDef fast fill:#009688,stroke:#004d40,stroke-width:2px,color:#fff;
    classDef db fill:#00758F,stroke:#004a5a,stroke-width:2px,color:#fff;
    classDef external fill:#FF9900,stroke:#cc7a00,stroke-width:2px,color:#fff;

    %% 노드 정의
    subgraph Frontend [Client - React SPA]
        A["🖥️ Web Browser (App.jsx)"]:::react
    end

    subgraph Backend [Backend Service - Java]
        B["🌱 Spring Boot Server<br>(PolicyController / Service)"]:::spring
    end

    subgraph AI_Engine [AI & RAG Engine - FastAPI]
        C["⚡ FastAPI Server (main.py)"]:::fast
        D["🧠 LLM (Gemini 2.5 Flash)"]:::fast
        E["🗄️ ChromaDB (Vector Store)"]:::fast
        F["📊 Embedding Model<br>(all-MiniLM-L6-v2)"]:::fast
    end

    subgraph Database [Storage]
        G["🐬 MySQL Database"]:::db
    end

    subgraph External [External Services]
        H["✉️ SMTP Mail Server"]:::external
        I["💬 KakaoTalk API (Simulated)"]:::external
    end

    %% 데이터 흐름 정의
    A -->|"1. 회원가입/로그인/보유서류 저장"| B
    B <-->|"2. 유저 정보 & 서류정보 관리"| G
    B -->|"3. 맞춤 추천 요청 (/api/policies/recommend)"| C
    C -->|"4. 사용자 조건 임베딩화"| F
    F -->|"5. 유사 정책 문서 조각 탐색"| E
    E -->|"6. RAG 컨텍스트 생성"| C
    C -->|"7. 프롬프트 대조 매칭 분석"| D
    D -->|"8. 구조화된 추천 리스트 (JSON)"| C
    C -->|"9. 오프라인 메타데이터 검증 & 2차 필터링<br>(지역/만료기한/특수조건)"| C
    C -->|"10. 정제된 추천 리스트 응답"| B
    B -->|"11. 최종 API 결과 반환"| A

    %% 알림 시스템 흐름
    B -->|"12. 마감 임박 알림 자동 메일 발송"| H
    A -->|"13. 마감 알림 토스트 & 알림톡 렌더링"| I
```

---

## 2. [Slide 3] RAG 및 매칭 프로세스 흐름도 (Sequence & Pipeline)
* **목적**: 사용자가 온보딩을 진행할 때 ChromaDB에서 문서를 찾고 AI 매칭 및 2차 필터링을 수행하는 상세 시퀀스 다이어그램입니다.
* **제작 사이트**: [Mermaid Live Editor](https://mermaid.live/)

```mermaid
sequenceDiagram
    autonumber
    actor User as 사용자 (React)
    participant Spring as 스프링 백엔드
    participant FastAPI as FastAPI AI서버
    participant DB as VectorDB (Chroma)
    participant LLM as Gemini AI

    User->>Spring: 온보딩 저장 및 추천 요청
    Spring->>FastAPI: POST /match (지역, 학적, 소득, 취업, 특수사항)
    Note over FastAPI: 1차 필터링 (RAG 단계)
    FastAPI->>DB: 사용자 조건 벡터 쿼리 검색 (k=200)
    DB-->>FastAPI: 관련 정책 청크(Chunk) 200개 반환
    Note over FastAPI: 200개 청크 중 신청 만료(기한 도과) 문서 제외
    FastAPI->>LLM: 정제된 RAG 컨텍스트 + 매칭 지시 프롬프트 전달
    LLM-->>FastAPI: 구조화된 추천(policies) 및 탈락(filtered_out) 리스트 반환
    Note over FastAPI: 2차 필터링 (Post-LLM 단계)
    Note over FastAPI: 1. condition_text 추출<br>2. 지역 불일치 제외 (is_region_mismatched)<br>3. 특수조건 키워드 불일치 제외 (is_special_mismatched)
    FastAPI-->>Spring: 최종 1순위(match_rate>=80) 및 2순위(match_rate<80) 정책 반환
    Spring-->>User: 화면 갱신 (스크롤 최상단 리셋 및 카드 렌더링)
```

---

## 3. [Slide 5] 데이터베이스 관계 스키마 (MySQL ERD)
* **목적**: 데이터베이스 테이블 관계 시각화
* **제작 사이트**: [dbdiagram.io](https://dbdiagram.io/)

```dbml
// dbdiagram.io 에 붙여넣을 코드
Table users {
  id integer [primary key, increment]
  username varchar [unique, not null]
  region varchar
  education varchar
  job varchar
  housing varchar
  housing_detail varchar
  income varchar
  birth_date varchar
  interest varchar
  email varchar
}

Table policies {
  id integer [primary key, increment]
  policy_name varchar [unique, not null]
  apply_link text
  detail_link text
  apply_method text
  eligibility text
  region varchar
  education varchar
  job varchar
  housing varchar
  housing_detail varchar
  income varchar
  interest varchar
  end_date varchar
  match_rate integer
  agency varchar
  reason text
  content text [not null]
}

Table policy_intents {
  id integer [primary key, increment]
  username varchar [not null]
  policy_id integer [not null]
  status varchar [not null]
  ignore_reason varchar
  reason text
  eligibility text
}

Table policy_required_docs {
  policy_id integer [not null]
  document_name varchar [not null]
}

Table policy_specials {
  policy_id integer [not null]
  special_name varchar [not null]
}

Table user_documents {
  id integer [primary key, increment]
  username varchar [not null]
  document_name varchar [not null]
}

Ref: policy_intents.policy_id > policies.id
Ref: policy_required_docs.policy_id > policies.id
Ref: policy_specials.policy_id > policies.id
Ref: policy_intents.username > users.username
Ref: user_documents.username > users.username
```

---

## 4. [Slide 9] 시행착오 극복: 상세 링크 오프라인 캐싱 흐름 (Caching Pipeline)
* **목적**: Gov24 크롤링의 지연 속도를 줄이기 위해 미리 배치로 수집해 둔 구조 시각화

```mermaid
graph LR
    classDef folder fill:#ffcc00,stroke:#e6b800,stroke-width:2px,color:#000;
    classDef script fill:#61DAFB,stroke:#1b82a1,stroke-width:2px,color:#000;
    classDef cache fill:#009688,stroke:#004d40,stroke-width:2px,color:#fff;
    classDef server fill:#6DB33F,stroke:#2b5722,stroke-width:2px,color:#fff;

    A["📂 policy_details/*.txt<br>(3075개 전체 정책)"]:::folder
    B["🐍 resolve_policy_links.py<br>(오프라인 배치 스크립트)"]:::script
    C["❌ 만료 정책 (293개)<br>및 Base Link 필터링"]:::script
    D["🤖 Selenium Crawler<br>(Gov24+ 상세 페이지 크롤러)"]:::script
    E["💾 policy_links.json<br>(2964개 캐시 완료)"]:::cache
    F["🚀 FastAPI 서버 기동<br>(main.py Startup)"]:::server
    G["⚡ 실시간 온보딩 추천<br>(0ms 즉시 링크 제공)"]:::server

    A --> B
    B --> C
    C -->|크롤링 필요 대상| D
    C -->|일반 링크| E
    D --> E
    E --> F
    F --> G
```

---

## 5. [Slide 2] 기존 복지 플랫폼 vs 본 개발 시스템 비교표 (Comparison Matrix)

| 비교 항목 | 기존 복지 플랫폼 (정부24 / 복지로) | 본 연구 개발 시스템 (Gov24+) |
| :--- | :--- | :--- |
| **정보 검색 방식** | 사용자가 수많은 공고문을 직접 읽고 비교 | 사용자의 온보딩 프로필 기반 **자동 매칭** |
| **자격요건 해석** | 복잡한 조건문(소득 등)을 직접 판단 | **RAG & LLM**을 통한 조건 자동 판단 |
| **만료 공고 노출** | 이미 마감된 공고가 노출되어 무의미한 탐색 유발 | 2중 필터링을 통해 **마감 정책 100% 자동 격리** |
| **서류 정합성 검증** | 제출 서류 목록을 직접 수동으로 매칭 | 유저의 **보유 서류와 공고 서류의 자동 대조** |
| **상세 신청 링크** | 대표 포털 주소만 제공되어 상세 검색 필요 | Pre-resolution 기술로 **상세 신청 페이지 직접 연결** |
