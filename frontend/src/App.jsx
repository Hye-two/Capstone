import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// 📍 대한민국 17개 광역자치단체 및 하위 자치시/군/구 매핑 사전
const KOREA_REGIONS = {
  "서울특별시": ["전체", "종로구", "중구", "용산구", "성동구", "광진구", "동대문구", "중랑구", "성북구", "강북구", "도봉구", "노원구", "은평구", "서대문구", "마포구", "양천구", "강서구", "구로구", "금천구", "영등포구", "동작구", "관악구", "서초구", "강남구", "송파구", "강동구"],
  "부산광역시": ["전체", "중구", "서구", "동구", "영도구", "부산진구", "동래구", "남구", "북구", "해운대구", "사하구", "금정구", "강서구", "연제구", "수영구", "사상구", "기장군"],
  "대구광역시": ["전체", "중구", "남구", "서구", "북구", "동구", "수성구", "달서구", "달성군", "군위군"],
  "인천광역시": ["전체", "중구", "동구", "미추홀구", "연수구", "남동구", "부평구", "계양구", "서구", "강화군", "옹진군"],
  "광주광역시": ["전체", "동구", "서구", "남구", "북구", "광산구"],
  "대전광역시": ["전체", "동구", "중구", "서구", "유성구", "대덕구"],
  "울산광역시": ["전체", "중구", "남구", "동구", "북구", "울주군"],
  "세종특별자치시": ["전체"],
  "경기도": ["전체", "수원시", "성남시", "의정부시", "안양시", "부천시", "광명시", "평택시", "동두천시", "안산시", "고양시", "과천시", "구리시", "남양주시", "오산시", "시흥시", "군포시", "의왕시", "하남시", "용인시", "파주시", "이천시", "안성시", "김포시", "화성시", "광주시", "양주시", "포천시", "여주시", "연천군", "가평군", "양평군"],
  "강원특별자치도": ["전체", "춘천시", "원주시", "강릉시", "동해시", "태백시", "속초시", "삼척시", "홍천군", "횡성군", "영월군", "평창군", "정선군", "철원군", "화천군", "양구군", "인제군", "고성군", "양양군"],
  "충청북도": ["전체", "청주시", "충주시", "제천시", "보은군", "옥천군", "영동군", "증평군", "진천군", "괴산군", "음성군", "단양군"],
  "충청남도": ["전체", "천안시", "공주시", "보령시", "아산시", "서산시", "논산시", "계룡시", "당진시", "금산군", "부여군", "서천군", "청양군", "홍성군", "예산군", "태안군"],
  "전북특별자치도": ["전체", "전주시", "군산시", "익산시", "정읍시", "남원시", "김제시", "완주군", "진안군", "무주군", "장수군", "임실군", "순창군", "고창군", "부안군"],
  "전라남도": ["전체", "목포시", "여수시", "순천시", "나주시", "광양시", "담양군", "곡성군", "구례군", "고흥군", "보성군", "화순군", "장흥군", "강진군", "해남군", "영암군", "무안군", "함평군", "영광군", "장성군", "완도군", "진도군", "신안군"],
  "경상북도": ["전체", "포항시", "경주시", "김천시", "안동시", "구미시", "영주시", "영천시", "상주시", "문경시", "경산시", "의성군", "청송군", "영양군", "영덕군", "청도군", "고령군", "성주군", "칠곡군", "예천군", "봉화군", "울진군", "울릉군"],
  "경상남도": ["전체", "창원시", "진주시", "통영시", "사천시", "김해시", "밀양시", "거제시", "양산시", "의령군", "함안군", "창녕군", "고성군", "남해군", "하동군", "산청군", "함양군", "거창군", "합천군"],
  "제주특별자치도": ["전체", "제주시", "서귀포시"]
};

// 📍 백엔드 저장된 region 텍스트(예: "광주광역시 북구")를 분할해 복원하는 헬퍼 함수
const parseRegion = (regionStr) => {
  if (!regionStr) return { sido: "광주광역시", sigungu: "전체" };
  
  let parts = regionStr.split(' ');
  let sido = parts[0];
  let sigungu = parts[1] || "전체";

  // 이전 버전 하위 호환 및 약칭 변환 보정
  if (sido === '광주') sido = '광주광역시';
  if (sido === '서울') sido = '서울특별시';
  if (sido === '전남') sido = '전라남도';
  if (sido === '전북') sido = '전북특별자치도';
  if (sido === '경남') sido = '경상남도';
  if (sido === '경북') sido = '경상북도';
  if (sido === '충남') sido = '충청남도';
  if (sido === '충북') sido = '충청북도';
  if (sido === '강원') sido = '강원특별자치도';
  if (sido === '제주') sido = '제주특별자치도';

  if (!KOREA_REGIONS[sido]) {
    sido = "광주광역시";
  }
  
  if (!KOREA_REGIONS[sido].includes(sigungu)) {
    sigungu = "전체";
  }

  return { sido, sigungu };
};

// 🎗️ 정부24 혜택알리미 기반 50+ 세부 특수 상황 & 우대 조건 그룹화 정의
const SPECIAL_GROUPS = [
  {
    title: "👶 가족 돌봄 및 양육",
    items: [
      "아기를 키우고 있어요", "아이 둘 이상이에요", "학생 자녀가 있어요",
      "다양한 가족이에요", "혼자(또는 조부모) 키워요", "임신 준비 중이에요",
      "임신 중이에요", "출산 직후예요", "육아휴직 중이에요",
      "부모님을 돌보고 있어요", "장기요양이 필요해요", "치매 돌봄이 필요해요",
      "혼자(어르신) 살고 있어요"
    ]
  },
  {
    title: "💰 생활비 및 자립 지원",
    items: [
      "신혼부부예요", "학교 밖 청소년이에요", "돌봄을 졸업했어요",
      "위탁가정(돌봄가정)에서 지내요", "대학생/졸업예정자예요", "취업 준비 중이에요",
      "중소기업에 다니는 청년이에요", "창업 준비 중인 청년이에요", "비수도권에 살아요",
      "군을 제대했어요", "학자금 대출을 갚고 있어요", "혼자 사는 청년이에요",
      "65세 이상이에요"
    ]
  },
  {
    title: "💼 직업 및 업종 맞춤",
    items: [
      "농업/임업에 종사해요", "어업에 종사해요", "축산에 종사해요",
      "귀농·귀촌·귀어 준비 중이에요", "소상공인이에요", "장사가 어려운 소상공인이에요",
      "대출이 있는 소상공인이에요", "재도약을 준비하는 기업이에요", "프리랜서/플랫폼 노동자예요",
      "문화·체육·건설·교직원이에요"
    ]
  },
  {
    title: "🏠 현재 상황 및 취약계층",
    items: [
      "보훈대상자/가족이에요", "금융이 어려워요", "목돈을 모으고 싶어요",
      "기초생활수급자예요", "저소득 가구예요", "긴급복지를 받고 있어요",
      "재난·사고 피해자예요", "범죄·폭력 피해자예요", "실업 상태예요",
      "재취업 준비 중인 중장년이에요", "집이 없어요", "전세자금 대출이 필요해요",
      "공공임대주택에 입주하고 싶어요", "주거가 취약해요", "연금을 받고 있어요"
    ]
  },
  {
    title: "♿ 장애 및 복지시설",
    items: [
      "일자리를 찾는 장애인이에요", "장애인/가족이에요", "장애아동이에요",
      "발달장애가 있어요", "시설을 이용하고 있어요"
    ]
  },
  {
    title: "🏥 의료 지원",
    items: [
      "만성질환자에요", "암 치료를 받고 있어요"
    ]
  }
];

function App() {
  // Authentication states
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authSuccess, setAuthSuccess] = useState(null);

  // 📧 아이디/비밀번호 찾기 모달 관련 State
  const [showFindModal, setShowFindModal] = useState(null); // 'id', 'pw', null
  const [findEmail, setFindEmail] = useState('');
  const [findUsernameVal, setFindUsernameVal] = useState('');
  const [findCode, setFindCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [foundUsername, setFoundUsername] = useState('');
  const [findSuccessMsg, setFindSuccessMsg] = useState(null);
  const [findErrorMsg, setFindErrorMsg] = useState(null);
  const [showIncomeModal, setShowIncomeModal] = useState(false);

  // Active Menu: 'DASHBOARD', 'DOCUMENTS', 'PROFILE'
  const [activeMenu, setActiveMenu] = useState('DASHBOARD');

  // 8대 조건 State 선언 및 초기값 설정
  const [region, setRegion] = useState('광주광역시 전체');
  const [selectedSido, setSelectedSido] = useState('광주광역시');
  const [selectedSigungu, setSelectedSigungu] = useState('전체');
  const [education, setEducation] = useState('제한 없음');
  const [job, setJob] = useState('미취업');
  const [housing, setHousing] = useState('무주택');
  const [housingDetail, setHousingDetail] = useState('월세');
  const [income, setIncome] = useState('51 ~ 75%');
  const [interest, setInterest] = useState('주거');
  const [special, setSpecial] = useState([]);
  const [birthDate, setBirthDate] = useState('2000-01-01'); // 사용자의 생년월일

  // 만 나이 자동 계산 헬퍼 함수 (검색/매칭 시점 기준)
  const calculateManAge = (birthDateStr) => {
    if (!birthDateStr) return 25;
    const today = new Date();
    const birth = new Date(birthDateStr);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // 유효한 링크 후보군 중 첫 번째를 반환하는 헬퍼 함수 ('unknown' 제외)
  const getValidLink = (policy, prioritizeDetail = false) => {
    if (!policy) return null;
    const candidates = prioritizeDetail 
      ? [policy.detail_link, policy.detailLink, policy.apply_link, policy.applyLink]
      : [policy.apply_link, policy.applyLink, policy.detail_link, policy.detailLink];
      
    for (const val of candidates) {
      if (val && val !== 'unknown' && val.trim() !== '' && (val.startsWith('http://') || val.startsWith('https://'))) {
        return val;
      }
    }
    return null;
  };

  // 일반 링크만 안전하게 추출하는 함수
  const getGeneralLinkOnly = (policy) => {
    if (!policy) return null;
    const val = policy.apply_link || policy.applyLink;
    if (val && val !== 'unknown' && val.trim() !== '' && (val.startsWith('http://') || val.startsWith('https://'))) {
      return val;
    }
    return null;
  };

  // 상세 링크만 안전하게 추출하는 함수
  const getDetailLinkOnly = (policy) => {
    if (!policy) return null;
    const val = policy.detail_link || policy.detailLink;
    if (val && val !== 'unknown' && val.trim() !== '' && (val.startsWith('http://') || val.startsWith('https://'))) {
      return val;
    }
    return null;
  };

  // 결과 출력 및 상태 관리
  const [policies, setPolicies] = useState([]);
  const [filteredOutPolicies, setFilteredOutPolicies] = useState([]); // AI가 조건 불가로 탈락시킨 정책 목록
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  // 고도화 State들
  const [ownedDocuments, setOwnedDocuments] = useState([]); // 유저 보유 서류 목록
  const [alerts, setAlerts] = useState([]); // D-day 마감 임박 알림 목록
  const [currentTab, setCurrentTab] = useState('ALL'); // ALL, RECOMMENDED, PLANNING, IN_PROGRESS, APPLIED
  const [showDeclineModal, setShowDeclineModal] = useState(false); // 거절 피드백 모달 오픈 여부
  const [selectedDeclinePolicyId, setSelectedDeclinePolicyId] = useState(null); // 거절 선택한 정책 ID
  const [declineReason, setDeclineReason] = useState('지원 대상에 해당되지 않음 (나이, 소득 등 요건 불충족)'); // 선택된 거절 피드백 사유
  
  // 파일 업로드 관련 고도화 State들
  const [uploadedDocs, setUploadedDocs] = useState([]); // 업로드된 실제 파일 목록
  const [selectedFile, setSelectedFile] = useState(null); // 선택된 파일 객체
  const [uploadingFile, setUploadingFile] = useState(false); // 업로드 로딩 여부
  const [desktopPath, setDesktopPath] = useState(''); // 실제 바탕화면 경로
  const [loadingProgress, setLoadingProgress] = useState(0); // 로딩 퍼센티지
  const [loadingStepText, setLoadingStepText] = useState(''); // 로딩 진행 상황 텍스트


  // 💬 카카오톡 알림톡 시뮬레이션용 State
  const [kakaoToasts, setKakaoToasts] = useState([]);

  // 표준 서류 전체 후보군 목록 (직접 추가 지원을 위해 State로 관리)
  const [documentCandidates, setDocumentCandidates] = useState([
    '주민등록등본',
    '주민등록초본',
    '가족관계증명서',
    '건강보험자격득실확인서',
    '소득금액증명원',
    '재학증명서',
    '졸업증명서',
    '사업자등록증'
  ]);
  const [newDocName, setNewDocName] = useState('');
  const [isEditingDocs, setIsEditingDocs] = useState(false); // ✏️ 서류 삭제/편집 모드 활성화 여부
  const [showChatbot, setShowChatbot] = useState(false); // 🤖 챗봇 창 열림 여부
  const [chatMessages, setChatMessages] = useState([
    { sender: 'bot', text: '안녕하세요! 청년 정책 및 행정 지식 가이드 AI 비서입니다. 정책 자격 조건이나 서류 발급, 소득 산정 등 무엇이든 질문해 주세요!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // 🤖 AI 챗봇 드래그 질문 기능 관련 State
  const [selectedText, setSelectedText] = useState(''); // 드래그 선택된 텍스트
  const [draggedPolicy, setDraggedPolicy] = useState(null); // 드래그가 일어난 정책 카드 정보
  const [tooltipCoords, setTooltipCoords] = useState({ x: 0, y: 0 }); // 툴팁 노출 좌표
  const [showDragTooltip, setShowDragTooltip] = useState(false); // 드래그 툴팁 노출 여부

  // 🚀 컴포넌트 로드 시 로컬스토리지 체크하여 로그인 유지
  useEffect(() => {
    const savedUser = localStorage.getItem('username');
    if (savedUser) {
      setUsername(savedUser);
      setIsLoggedIn(true);
      loadUserData(savedUser);
    }
  }, []);

  // 1. 로그인한 사용자의 데이터 로드
  const loadUserData = async (user) => {
    try {
      // 온보딩 프로필 로드
      const response = await axios.get('http://localhost:8080/api/users/profile', {
        params: { username: user }
      });
      const profile = response.data;
      if (profile.region) {
        setRegion(profile.region);
        const { sido, sigungu } = parseRegion(profile.region);
        setSelectedSido(sido);
        setSelectedSigungu(sigungu);
      }
      if (profile.education) setEducation(profile.education);
      if (profile.job) setJob(profile.job);
      if (profile.housing) setHousing(profile.housing);
      if (profile.housingDetail) setHousingDetail(profile.housingDetail);
      if (profile.income) setIncome(profile.income);
      if (profile.interest) setInterest(profile.interest);
      if (profile.special) setSpecial(profile.special);
      if (profile.birthDate) setBirthDate(profile.birthDate);
    } catch (err) {
      console.error('사용자 프로필 로드 실패:', err);
    }

    // 문서함, 정책 목록, 알림 조회
    fetchOwnedDocuments(user);
    fetchSavedPolicies(user);
    fetchDDayAlerts(user, true); // 로그인 시 데스크톱 알림 발생
  };


  // 2. 유저 보유 서류 목록 가져오기
  const fetchOwnedDocuments = async (user = username) => {
    if (!user) return;
    try {
      const response = await axios.get('http://localhost:8080/api/policies/documents', {
        params: { username: user }
      });
      const owned = response.data || [];
      setOwnedDocuments(owned);
      
      // 후보군 목록에 없는 서류가 DB에 있다면 동적으로 추가
      setDocumentCandidates(prev => {
        const newDocs = owned.filter(doc => doc && !prev.includes(doc));
        if (newDocs.length > 0) {
          return [...prev, ...newDocs];
        }
        return prev;
      });
    } catch (err) {
      console.error('서류 목록 조회 실패:', err);
    }
  };

  const isBaseLinkFormat = (url) => {
    if (!url || url === 'unknown') return false;
    try {
      const parsed = new URL(url);
      const path = parsed.pathname.replace(/^\/|\/$/g, '');
      if (path === '' || ['portal', 'index.html', 'index.jsp', 'main.do', 'main'].includes(path)) {
        return true;
      }
      const domain = parsed.hostname.toLowerCase();
      if (domain.endsWith('.kr') || domain.endsWith('.net') || domain.endsWith('.com')) {
        if (!parsed.search && path.split('/').length <= 1) {
          return true;
        }
      }
      return false;
    } catch (e) {
      return url.endsWith('.kr') || url.endsWith('.net') || url.endsWith('.com');
    }
  };
 
  // 💡 [실시간 상세 링크 탐색 기능 복원]
  const resolvePolicyLinks = async (policiesList) => {
    if (!policiesList || policiesList.length === 0) return;
    
    // 상세 링크가 없거나 'unknown'인 정책 카드만 필터링하여 비동기로 백엔드에 탐색 요청
    const targets = policiesList.filter(p => {
      const detail = p.detail_link || p.detailLink;
      return !detail || detail === 'unknown';
    });
    
    targets.forEach(async (policy) => {
      try {
        const response = await axios.post('http://localhost:8080/api/policies/resolve-link', {
          policyId: policy.policyId,
          policyName: policy.policy_name,
          applyLink: policy.apply_link || policy.applyLink,
          eligibility: policy.eligibility
        });
        
        if (response.data && response.data.detailLink && response.data.detailLink !== 'unknown') {
          // 로컬 상태에 실시간으로 수집된 상세 링크 즉시 업데이트 반영
          setPolicies(prev => prev.map(p => {
            if (p.policyId === policy.policyId) {
              return { 
                ...p, 
                detail_link: response.data.detailLink, 
                detailLink: response.data.detailLink 
              };
            }
            return p;
          }));
        }
      } catch (err) {
        console.error(`Failed to resolve detail link for '${policy.policy_name}':`, err);
      }
    });
  };


  // 3. 이미 MySQL DB에 저장되어 있는 정책 목록 가져오기
  const fetchSavedPolicies = async (user = username) => {
    if (!user) return;
    try {
      const response = await axios.get('http://localhost:8080/api/policies', {
        params: { username: user }
      });
      if (response.data && response.data.length > 0) {
        setPolicies(response.data);
        setSearched(true);
        resolvePolicyLinks(response.data); // 백그라운드 상세 링크 수집 시작
      } else {
        setPolicies([]);
        setSearched(false);
      }
    } catch (err) {
      console.error('저장된 정책 조회 실패:', err);
    }
  };

  // 4. D-day 마감 임박 알림 목록 가져오기 (데스크톱 푸시 및 카카오톡 시뮬레이션 연동)
  const fetchDDayAlerts = async (user = username, triggerPush = false) => {
    if (!user) return;
    try {
      const response = await axios.get('http://localhost:8080/api/policies/alerts', {
        params: { username: user }
      });
      setAlerts(response.data);

      if (triggerPush && response.data.length > 0) {
        // 브라우저 데스크톱 알림 요청 및 송신
        if ('Notification' in window) {
          if (Notification.permission === 'granted') {
            sendNotifications(response.data);
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then((permission) => {
              if (permission === 'granted') {
                sendNotifications(response.data);
              }
            });
          }
        }

        // 💡 [시각적 극대화] 카카오톡 스타일 토스트 팝업 순차적 노출
        response.data.forEach((alert, idx) => {
          if (alert.daysLeft === 7 || alert.daysLeft === 1 || alert.daysLeft === 0) {
            setTimeout(() => {
              triggerKakaoToast(alert.title, alert.daysLeft);
            }, idx * 1200); // 1.2초 간격으로 노란색 카톡 팝업 노출
          }
        });
      }
    } catch (err) {
      console.error('D-day 알림 조회 실패:', err);
    }
  };

  // 💬 카카오톡 알림톡 생성 및 4초 뒤 자동 페이드아웃 설정
  const triggerKakaoToast = (title, daysLeft) => {
    const id = Date.now() + Math.random();
    const text = daysLeft === 0 
      ? `오늘 마감 기한이 도달했습니다! 지금 바로 온라인 신청을 최종 완료해 주세요.` 
      : `마감일까지 단 ${daysLeft}일 남았습니다. 구비 서류를 다시 확인해 주세요!`;
    
    const newToast = { id, title, text };
    setKakaoToasts((prev) => [...prev, newToast]);

    // 4.5초 뒤 제거
    setTimeout(() => {
      setKakaoToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // 실제 데스크톱 OS 팝업 알림 송신
  const sendNotifications = (alertList) => {
    alertList.forEach((alert) => {
      // D-7, D-1, D-0일 때만 팝업 알림 송신
      if (alert.daysLeft === 7 || alert.daysLeft === 1 || alert.daysLeft === 0) {
        const text = alert.daysLeft === 0 
          ? `[오늘 마감] "${alert.title}"의 신청 기간이 오늘 마감됩니다! 서둘러 신청하세요.` 
          : `[D-${alert.daysLeft}] "${alert.title}"의 신청 마감일이 ${alert.daysLeft}일 남았습니다. 놓치지 말고 신청하세요!`;
        
        new Notification('📅 Gov24+ 마감 임박 알림', {
          body: text,
          icon: '/logo192.png'
        });
      }
    });
  };

  // 5. 로그인 처리 함수
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const response = await axios.post('http://localhost:8080/api/users/login', {
        username: loginUsername,
        password: loginPassword
      });
      const user = response.data.username;
      localStorage.setItem('username', user);
      setUsername(user);
      setIsLoggedIn(true);
      setLoginPassword('');
      await loadUserData(user);
    } catch (err) {
      console.error(err);
      setAuthError(err.response?.data?.message || '로그인에 실패했습니다. 아이디와 비밀번호를 확인해 주세요.');
    } finally {
      setAuthLoading(false);
    }
  };

  // 6. 회원가입 처리 함수
  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      await axios.post('http://localhost:8080/api/users/register', {
        username: registerUsername,
        password: registerPassword,
        email: registerEmail
      });
      setAuthSuccess('회원가입이 완료되었습니다. 로그인 해주세요.');
      setAuthMode('login');
      setLoginUsername(registerUsername);
      setRegisterUsername('');
      setRegisterPassword('');
      setRegisterEmail('');
    } catch (err) {
      console.error(err);
      setAuthError(err.response?.data?.message || '회원가입에 실패했습니다. 이미 사용 중인 아이디 또는 이메일일 수 있습니다.');
    } finally {
      setAuthLoading(false);
    }
  };

  // 📧 아이디 찾기 인증코드 전송 API 호출
  const handleSendCodeForFindId = async (e) => {
    e.preventDefault();
    setFindErrorMsg(null);
    setFindSuccessMsg(null);
    try {
      await axios.post('http://localhost:8080/api/users/find/send-code', {
        email: findEmail
      });
      setIsCodeSent(true);
      setFindSuccessMsg('입력하신 이메일로 인증코드가 발송되었습니다. (백엔드 콘솔 창에서 확인 가능)');
    } catch (err) {
      setFindErrorMsg(err.response?.data?.message || '인증코드 발송에 실패했습니다. 등록된 이메일을 확인해 주세요.');
    }
  };

  // 📧 이메일 인증코드로 아이디 찾기 확인 API 호출
  const handleVerifyCodeForFindId = async (e) => {
    e.preventDefault();
    setFindErrorMsg(null);
    setFindSuccessMsg(null);
    try {
      const response = await axios.post('http://localhost:8080/api/users/find/username', {
        email: findEmail,
        code: findCode
      });
      setFoundUsername(response.data.username);
      setFindSuccessMsg('아이디 조회가 성공했습니다!');
    } catch (err) {
      setFindErrorMsg(err.response?.data?.message || '인증번호 검증에 실패했습니다.');
    }
  };

  // 📧 비밀번호 재설정 인증코드 전송 API 호출
  const handleSendCodeForResetPw = async (e) => {
    e.preventDefault();
    setFindErrorMsg(null);
    setFindSuccessMsg(null);
    try {
      await axios.post('http://localhost:8080/api/users/find/send-code', {
        username: findUsernameVal,
        email: findEmail
      });
      setIsCodeSent(true);
      setFindSuccessMsg('입력하신 이메일로 인증코드가 발송되었습니다. (백엔드 콘솔 창에서 확인 가능)');
    } catch (err) {
      setFindErrorMsg(err.response?.data?.message || '인증코드 발송에 실패했습니다. 아이디 또는 이메일을 확인해 주세요.');
    }
  };

  // 📧 비밀번호 재설정 완료 API 호출
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setFindErrorMsg(null);
    setFindSuccessMsg(null);
    try {
      await axios.post('http://localhost:8080/api/users/find/reset-password', {
        username: findUsernameVal,
        email: findEmail,
        code: findCode,
        newPassword: resetNewPassword
      });
      alert('비밀번호가 성공적으로 변경되었습니다. 변경된 비밀번호로 로그인해 주세요.');
      closeFindModal();
    } catch (err) {
      setFindErrorMsg(err.response?.data?.message || '비밀번호 변경에 실패했습니다. 입력한 정보를 확인해 주세요.');
    }
  };

  const closeFindModal = () => {
    setShowFindModal(null);
    setFindEmail('');
    setFindUsernameVal('');
    setFindCode('');
    setIsCodeSent(false);
    setResetNewPassword('');
    setFoundUsername('');
    setFindSuccessMsg(null);
    setFindErrorMsg(null);
  };

  // 7. 로그아웃 처리 함수
  const handleLogout = () => {
    localStorage.removeItem('username');
    setUsername('');
    setIsLoggedIn(false);
    setPolicies([]);
    setFilteredOutPolicies([]);
    setOwnedDocuments([]);
    setAlerts([]);
    setSearched(false);
    setActiveMenu('DASHBOARD');
  };


  // 8. 보유 서류 체크 상태 변경 시 로컬 상태 업데이트
  const handleDocumentToggle = (docName) => {
    let updatedDocs;
    if (ownedDocuments.includes(docName)) {
      updatedDocs = ownedDocuments.filter((d) => d !== docName);
    } else {
      updatedDocs = [...ownedDocuments, docName];
    }
    setOwnedDocuments(updatedDocs);
  };

  // 8-2. 서류 직접 명칭 기입하여 보유 리스트에 추가 (플러스 버튼 연동)
  const handleAddDocument = () => {
    const trimmed = newDocName.trim();
    if (!trimmed) return;
    
    // 이미 후보군에 있는 경우
    if (documentCandidates.includes(trimmed)) {
      if (!ownedDocuments.includes(trimmed)) {
        handleDocumentToggle(trimmed);
      }
      setNewDocName('');
      return;
    }
    
    // 후보군과 보유 목록 둘 다에 추가
    const updatedCandidates = [...documentCandidates, trimmed];
    setDocumentCandidates(updatedCandidates);
    
    const updatedDocs = [...ownedDocuments, trimmed];
    setOwnedDocuments(updatedDocs);
    setNewDocName('');
  };

  // 8-3. 추가된 서류 후보 및 보유 리스트에서 삭제 처리 (연필 버튼 편집 상태 ❌ 버튼 연동)
  const handleDeleteDocument = (docName) => {
    const updatedCandidates = documentCandidates.filter((doc) => doc !== docName);
    setDocumentCandidates(updatedCandidates);

    const updatedDocs = ownedDocuments.filter((doc) => doc !== docName);
    setOwnedDocuments(updatedDocs);
  };

  // 8-3-2. 보유 서류 서버 저장 및 대조 결과 갱신 함수
  const handleSaveDocuments = async () => {
    setLoading(true);
    setLoadingProgress(10);
    setLoadingStepText('보유 서류의 정합성을 검증하는 중...');
    setError(null);
    let progressInterval = null;
    try {
      setLoadingProgress(35);
      setLoadingStepText('1단계: MySQL 데이터베이스에 서류 변경 정보를 동기화하는 중...');
      const uniqueDocs = Array.from(new Set(ownedDocuments));
      const response = await axios.post('http://localhost:8080/api/policies/documents', uniqueDocs, {
        params: { username }
      });
      if (response.data) {
        setOwnedDocuments(response.data);
      }
      
      setLoadingProgress(60);
      setLoadingStepText('2단계: 변경된 보유 서류와 전체 매칭 정책 정확도를 실시간 대조하는 중...');
      
      progressInterval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 95) return 95;
          return prev + 3;
        });
      }, 150);

      await fetchSavedPolicies(username);
      
      if (progressInterval) clearInterval(progressInterval);
      setLoadingProgress(100);
      setLoadingStepText('완료: 서류 대조 분석 결과 갱신이 완료되었습니다!');
      
      setTimeout(() => {
        alert('보유 서류가 성공적으로 저장되었으며 서류 대조 분석 결과가 갱신되었습니다.');
        setLoading(false);
      }, 500);
    } catch (err) {
      if (progressInterval) clearInterval(progressInterval);
      console.error('서류 저장 및 매칭 갱신 실패:', err);
      alert('서류 저장 중 에러가 발생했습니다.');
      setLoading(false);
    }
  };

  // 8-4. 🤖 AI 개인화 챗봇 대화 발송 함수
  const handleSendChatMessage = async (e, customQuery = null, customContext = null) => {
    if (e) e.preventDefault();
    const queryToSend = customQuery || chatInput;
    const trimmed = queryToSend.trim();
    if (!trimmed || chatLoading) return;

    const userMsg = { sender: 'user', text: trimmed };
    setChatMessages((prev) => [...prev, userMsg]);
    if (!customQuery) {
      setChatInput('');
    }
    setChatLoading(true);
    setShowChatbot(true); // 🤖 챗봇 창 열기

    try {
      const response = await axios.post(`http://localhost:8080/api/policies/chat`, {
        query: trimmed,
        username: username,
        policyContext: customContext || null,
        history: chatMessages
      }, {
        params: { username }
      });

      const botMsg = { sender: 'bot', text: response.data.answer || '답변을 불러오지 못했습니다.' };
      setChatMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error('챗봇 대화 실패:', err);
      setChatMessages((prev) => [...prev, { sender: 'bot', text: '죄송합니다. 서버 통신 도중 에러가 발생했습니다.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  // 🤖 AI 챗봇 드래그 선택 감지 핸들러
  const handleTextSelection = (e, policy) => {
    const selection = window.getSelection();
    if (!selection) return;

    const text = selection.toString().trim();

    // 1자 이상 유효한 드래그가 발생한 경우
    if (text && text.length > 1) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // 뷰포트 내 절대 좌표 (스크롤 오프셋 반영)
      const x = rect.left + window.scrollX + (rect.width / 2);
      const y = rect.top + window.scrollY - 45; // 선택 텍스트 약간 위에 띄움

      setSelectedText(text);
      setDraggedPolicy(policy);
      setTooltipCoords({ x, y });
      setShowDragTooltip(true);
    }
  };

  // 문서 전역 클릭 핸들러 (드래그 해제 시 툴팁 닫기)
  useEffect(() => {
    const handleDocumentClick = (e) => {
      // 툴팁 버튼 자체를 클릭한 경우 무시
      if (e.target.closest('.chatbot-drag-tooltip-btn')) {
        return;
      }
      
      const selection = window.getSelection();
      if (!selection || selection.toString().trim() === '') {
        setShowDragTooltip(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, []);

  // 드래그한 텍스트로 즉시 질문 발송
  const handleAskDragText = () => {
    if (!selectedText || !draggedPolicy) return;

    // 환각 방지를 위해 원본 공고 전체 텍스트 수집
    const policyContext = `
정책명: ${draggedPolicy.policyName || 'unknown'}
지원내용: ${draggedPolicy.reason || 'unknown'}
자격요건: ${draggedPolicy.eligibility || 'unknown'}
신청방법: ${draggedPolicy.applyMethod || 'unknown'}
구비서류: ${draggedPolicy.requiredDocuments ? draggedPolicy.requiredDocuments.join(', ') : '없음'}
마감기한: ${draggedPolicy.endDate || 'unknown'}
    `.trim();

    const query = `공고문 내용 중 "${selectedText}" 이 부분에 대해 자세히 설명해 줘.`;

    handleSendChatMessage(null, query, policyContext);

    // 초기화
    setShowDragTooltip(false);
    setSelectedText('');
    setDraggedPolicy(null);
  };

  // 공고 카드 우측 상단 상시 AI 질문 버튼 처리
  const handleAskAboutPolicy = (policy) => {
    if (!policy) return;

    const policyContext = `
정책명: ${policy.policyName || 'unknown'}
지원내용: ${policy.reason || 'unknown'}
자격요건: ${policy.eligibility || 'unknown'}
신청방법: ${policy.applyMethod || 'unknown'}
구비서류: ${policy.requiredDocuments ? policy.requiredDocuments.join(', ') : '없음'}
마감기한: ${policy.endDate || 'unknown'}
    `.trim();

    const query = `"${policy.policyName}" 정책에 대한 상세 지원 요건과 제출 서류를 저의 온보딩 프로필 조건과 연계하여 꼼꼼하게 정리해 주실 수 있나요?`;

    handleSendChatMessage(null, query, policyContext);
  };

  // 💡 정책 마감일의 마지막 날짜를 정밀하게 파싱하는 헬퍼 함수
  const parseLastDate = (dateStr) => {
    if (!dateStr) return null;
    const cleaned = dateStr.trim();
    
    // 상시, 연중 등 기한이 정해지지 않은 공고는 날짜 비교에서 제외
    const ignoreKeywords = ['상시', '연중', '소진', '미정', 'unknown'];
    if (ignoreKeywords.some(k => cleaned.includes(k))) {
      return null;
    }
    
    // ~ 또는 - 와 같은 기한 범위 문구를 분리하여 마지막 부분(종료일)을 타겟팅
    const parts = cleaned.split(/~|-/);
    
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i].trim();
      const numbers = part.match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        try {
          let year = new Date().getFullYear();
          let month = 0;
          let day = 1;
          
          if (numbers.length >= 3) {
            year = parseInt(numbers[0], 10);
            if (year < 100) year += 2000;
            month = parseInt(numbers[1], 10) - 1;
            day = parseInt(numbers[2], 10);
          } else {
            const firstNum = parseInt(numbers[0], 10);
            const secondNum = parseInt(numbers[1], 10);
            if (firstNum > 1000 || (firstNum > 20 && firstNum < 100)) {
              // YYYY.MM or YY.MM format
              year = firstNum < 100 ? firstNum + 2000 : firstNum;
              month = secondNum - 1;
              day = new Date(year, month + 1, 0).getDate();
            } else {
              // MM.DD format
              const firstNumbers = parts[0].match(/\d+/g);
              if (firstNumbers && firstNumbers.length >= 3) {
                const y = parseInt(firstNumbers[0], 10);
                year = y < 100 ? y + 2000 : y;
              }
              month = firstNum - 1;
              day = secondNum;
            }
          }
          
          const d = new Date(year, month, day);
          if (!isNaN(d.getTime())) {
            return d;
          }
        } catch (e) {}
      }
    }
    return null;
  };

  // 정책 마감 여부 판별 헬퍼
  const isPolicyExpired = (policy) => {
    if (!policy || !policy.end_date) {
      return false;
    }
    const cleaned = policy.end_date.trim();
    
    // 1. 명시적 마감 키워드 확인
    const closedKeywords = ["신청마감", "접수마감", "종료", "신청종료", "마감", "마감됨"];
    for (const kw of closedKeywords) {
      if (cleaned.includes(kw)) {
        return true;
      }
    }
    
    // 2. 종료 날짜를 추출하여 오늘 이전인지 정밀 비교
    const end = parseLastDate(cleaned);
    if (end) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return end.getTime() < today.getTime();
    }
    
    return false;
  };

  // AI 개인화 유저 성향 요약 생성 헬퍼
  const getAiPersonalizationSummary = () => {
    const appliedPolicies = policies.filter(p => p.userStatus === 'APPLIED');
    const declinedPolicies = policies.filter(p => p.userStatus === 'DECLINED');

    if (appliedPolicies.length === 0 && declinedPolicies.length === 0) {
      return "아직 등록된 '신청완료' 또는 '신청안함' 피드백 데이터가 부족하여 AI가 유저 성향을 분석 중입니다. 관심 공고를 신청하거나 관심 없는 공고에 '안함' 피드백을 주시면 분석 결과가 실시간 제공됩니다.";
    }

    // 선호 카테고리 분포 분석
    const categoryCounts = {};
    appliedPolicies.forEach(p => {
      categoryCounts[p.interest] = (categoryCounts[p.interest] || 0) + 1;
    });

    let favoriteCategory = '';
    let maxCount = 0;
    Object.entries(categoryCounts).forEach(([cat, count]) => {
      if (count > maxCount) {
        maxCount = count;
        favoriteCategory = cat;
      }
    });

    // 거절 사유 분석
    const declineReasons = declinedPolicies.map(p => p.ignoreReason || '');
    const hasLowBenefit = declineReasons.some(r => r.includes('혜택') || r.includes('금액') || r.includes('액수'));
    const hasIneligible = declineReasons.some(r => r.includes('대상') || r.includes('조건') || r.includes('자격'));

    let summaryParts = [];

    // 1. 선호 성향
    if (favoriteCategory) {
      summaryParts.push(`🎯 **[선호 분야]** 현재 유저님은 **[${favoriteCategory}]** 정책에 가장 높은 관심을 보이고 계십니다. 관련 유사 공고가 매칭될 경우 우선 정렬 가중치가 반영됩니다.`);
    } else if (appliedPolicies.length > 0) {
      summaryParts.push(`🎯 **[다각적 복지 관심]** 현재 여러 카테고리의 혜택 정책을 적극 탐색하고 계시며, 신청 완료된 항목 위주로 맞춤 추천이 갱신됩니다.`);
    }

    // 2. 기피 사유 피드백 성향
    if (hasLowBenefit) {
      summaryParts.push(`💸 **[실리적 혜택 선호]** 혜택 금액이 적거나 효율성이 낮다고 피드백하신 이력이 있습니다. 이로 인해 소액 혜택 정책의 추천 지수가 소폭 조절 중입니다.`);
    }
    if (hasIneligible) {
      summaryParts.push(`🛡️ **[자격 요건 민감도]** 본인 자격 요건과 부합하지 않는 정책에 대해 적극 필터링을 조치하시어, 불일치 공고를 리스트에서 실시간 제외하고 있습니다.`);
    }

    // 3. 서류 준비 상태 분석
    if (ownedDocuments.length >= 4) {
      summaryParts.push(`📂 **[서류 구비 상태]** 현재 주민등록등본, 소득금액증명원 등을 포함해 총 **${ownedDocuments.length}개**의 주요 서류를 보유하고 계셔, 복잡한 제출 요건 공고도 완벽히 소화 가능합니다.`);
    } else {
      summaryParts.push(`📂 **[서류 준비 가이드]** 현재 구비된 서류는 **${ownedDocuments.length}개**입니다. 필요 서류를 서류함에 추가 체크해 주시면 매칭 대조 정확도가 높아집니다.`);
    }

    return summaryParts.join('\n\n');
  };

  // AI 성향 보고서 볼드체 파서
  const parseAiPersonalizationSummaryMarkdown = (text) => {
    if (!text) return '';
    return text.split('\n\n').map((paragraph, pIdx) => {
      const parts = paragraph.split(/(\*\*[^*]+\*\*)/g);
      const elements = parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index} style={{ color: '#c7d2fe', fontWeight: 'bold' }}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });
      return <p key={pIdx} style={{ margin: '0 0 10px 0', minHeight: '1.2em' }}>{elements}</p>;
    });
  };

  // 카드 클릭 시 공식 신청 사이트로 이동하는 핸들러 (드래그 시 작동 방지)
  const handleCardClick = (e, policy) => {
    // 1. 만약 내부 버튼, 링크, 입력폼 등을 누른 거라면 클릭 무시 (이벤트 버블링 2차 방어)
    if (
      e.target.closest('button') || 
      e.target.closest('a') || 
      e.target.closest('input') || 
      e.target.closest('.chatbot-card-ask-btn')
    ) {
      return;
    }

    // 2. 실제로 사용자가 텍스트를 드래그해서 블록 지정을 했는지 검사 (가장 확실한 드래그 구분 방법)
    const selectedText = window.getSelection() ? window.getSelection().toString().trim() : '';
    if (selectedText !== '') {
      return; // 드래그 선택 중이므로 클릭 이동 방지
    }

    // 3. 만약 기본홈페이지링크이고 상세링크가 따로 존재하면 카드 클릭 시 기본홈페이지로 이동하며,
    // 그 외에는 상세링크(우선) 또는 일반링크로 이동합니다.
    const detailLink = getDetailLinkOnly(policy);
    const generalLink = getGeneralLinkOnly(policy);
    let targetLink = detailLink || generalLink;
    if (generalLink && isBaseLinkFormat(generalLink) && detailLink && detailLink !== generalLink) {
      targetLink = generalLink;
    }
    if (targetLink) {
      window.open(targetLink, '_blank', 'noopener,noreferrer');
      handleLinkClick(policy.policyId); // 상태 변경 트리거 (신청중 자동 전환)
    } else {
      alert(`[안내] 이 정책은 수집된 공식 신청 링크가 존재하지 않습니다. 하단의 신청 방법 및 문의처를 참고해 주세요.`);
    }
  };

  // 💡 [발표 시연 및 테스트용] 가짜 정책 카드 데이터 생성 및 주입
  const injectFakePolicyForDemo = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const fake = {
      policyId: 99999,
      policy_name: "[시연용] 만능 청년 주거·창업·학자금 지원금",
      apply_link: "https://www.gov.kr",
      detail_link: "https://www.gov.kr",
      apply_method: "온라인 접수 (정부24 및 본 플랫폼 로그인 후 간편 신청 가능)",
      reason: "사용자님이 **신혼부부**, **대학생**, **창업 준비**, **학자금 대출**, **전세자금 대출**, **혼자 사는 청년** 조건을 **제한 없이 동시에 다중 선택**하셨기에 최고 적합도인 99% 가중치로 특별 매칭되었습니다.",
      eligibility: "지역 무관. 대학생/졸업예정자이면서 신혼부부, 창업 준비 중인 청년, 학자금 대출 상환 중인 자, 전세자금 대출이 필요한 자, 혼자 사는 1인 청년 가구를 모두 동시에 중족하거나 다중 조건에 해당할 시 최대 지원.",
      interest: "주거",
      end_date: tomorrowStr,
      match_rate: 99,
      required_documents: ["주민등록등본", "대학재학증명서", "학자금대출증명원", "전세계약서"],
      ownedDocs: ["주민등록등본"],
      missingDocs: ["대학재학증명서", "학자금대출증명원", "전세계약서"],
      userStatus: "RECOMMENDED"
    };

    setPolicies(prev => [fake, ...prev.filter(p => p.policyId !== 99999)]);
    alert("시연용 만능 다중 조건 매칭 정책 카드가 대시보드 최상단에 주입되었습니다!\n(마감일 D-1로 스마트 알림 및 카카오톡 알림톡이 1초 뒤 연계 작동합니다.)");

    setTimeout(() => {
      // D-Day / D-1 알림을 위해 alerts state에도 임시 등록
      setAlerts([{ title: fake.policy_name, daysLeft: 1, policyId: 99999, endDate: tomorrowStr, applyLink: "https://www.gov.kr" }]);
      
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          sendNotifications([{ title: fake.policy_name, daysLeft: 1 }]);
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              sendNotifications([{ title: fake.policy_name, daysLeft: 1 }]);
            }
          });
        }
      }
      triggerKakaoToast(fake.policy_name, 1);
    }, 1200);
  };

  // 💡 [발표 시연 및 테스트용] 알림 팝업 즉시 강제 트리거
  const triggerNotificationSimulation = () => {
    if ('Notification' in window) {
      if (Notification.permission !== 'granted') {
        Notification.requestPermission();
      }
    }
    const mockAlerts = [
      { title: "[테스트] 2026 청년 주거 보증금 대출 지원사업", daysLeft: 1 },
      { title: "[테스트] 청년 창업 활성화 자금 특별공고", daysLeft: 0 }
    ];
    setAlerts(mockAlerts);
    sendNotifications(mockAlerts);
    mockAlerts.forEach((alert, idx) => {
      setTimeout(() => {
        triggerKakaoToast(alert.title, alert.daysLeft);
      }, idx * 800);
    });
  };

  // 9. 프로필 저장 및 추천받기 API 호출 함수
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoadingProgress(10);
    setLoadingStepText('온보딩 프로필 데이터의 유효성을 검증하는 중...');
    setError(null);
    setSearched(true);

    const payload = {
      region,
      education,
      job,
      housing,
      housingDetail,
      income,
      interest,
      special: special.length > 0 ? special : ["해당없음"],
      birthDate: birthDate,
      manAge: calculateManAge(birthDate)
    };

    let progressInterval = null;
    try {
      progressInterval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev < 35) {
            setLoadingStepText('1단계: MySQL 데이터베이스에 온보딩 프로필 정보를 동기화하는 중...');
            return prev + 5;
          } else if (prev < 65) {
            setLoadingStepText('2단계: ChromaDB 벡터 데이터베이스에서 후보 정책들을 탐색하는 중...');
            return prev + 3;
          } else if (prev < 95) {
            setLoadingStepText('3단계: Gemini AI가 조건문을 해독하여 개인 맞춤형 RAG 분석을 진행하는 중...');
            return prev + 2;
          } else {
            setLoadingStepText('AI가 조건문을 해독하여 프롬프트에 주입하는 중...');
            return 95;
          }
        });
      }, 150);

      // 💡 온보딩 프로필 저장 시, 체크된 보유 서류 정보도 백엔드에 선제 동기화 저장합니다.
      const uniqueDocs = Array.from(new Set(ownedDocuments));
      await axios.post('http://localhost:8080/api/policies/documents', uniqueDocs, {
        params: { username }
      });

      const response = await axios.post('http://localhost:8080/api/policies/recommend', payload, {
        params: { username },
        headers: { 'Content-Type': 'application/json' }
      });

      clearInterval(progressInterval);
      setLoadingProgress(100);
      setLoadingStepText('완료: 맞춤 정책 추천 로드가 끝났습니다!');

      // 완료 애니메이션을 체감할 수 있도록 약간의 딜레이 부여 후 완료 처리
      setTimeout(() => {
        // 새 응답 구조: { policies: [...], filtered_out: [...] }
        const data = response.data;
        const finalPolicies = data.policies || data;
        setPolicies(finalPolicies); // 하위호환: 배열이면 그대로, 객체면 .policies
        setFilteredOutPolicies(data.filtered_out || []);
        alert('프로필이 성공적으로 저장되었으며 맞춤 정책 추천 결과가 업데이트되었습니다.');
        setActiveMenu('DASHBOARD');
        fetchDDayAlerts(username);
        setLoading(false);
        resolvePolicyLinks(finalPolicies); // 백그라운드 상세 링크 수집 시작
      }, 500);

    } catch (err) {
      if (progressInterval) clearInterval(progressInterval);
      console.error(err);
      setError('서버와 통신하는 중 문제가 발생했습니다. 백엔드가 정상 작동하는지 확인해 주세요.');
      setLoading(false);
    }
  };

  // 10. 정책 신청 의사(Status) 변경 처리 함수
  const handleStatusChange = async (policyId, newStatus) => {
    if (newStatus === 'DECLINED') {
      // X를 선택했을 경우, 피드백 모달을 띄우고 보류
      setSelectedDeclinePolicyId(policyId);
      setShowDeclineModal(true);
      return;
    }

    try {
      await axios.post('http://localhost:8080/api/policies/intent', {
        policyId: policyId,
        status: newStatus,
        ignoreReason: ''
      }, {
        params: { username }
      });
      
      // 즉각적인 리스트 갱신 (피드백 가중치 정렬 순서 반영을 위해 전체 백엔드 조회)
      fetchSavedPolicies(username);
      // 알림도 즉시 갱신
      fetchDDayAlerts(username);
      // 신청 완료 시 서류가 자동 추가되므로 서류 정보 리로드
      if (newStatus === 'APPLIED') {
        fetchOwnedDocuments(username);
      }
    } catch (err) {
      console.error('상태 변경 실패:', err);
    }
  };

  // 11. X(거절) 피드백 사유 제출 함수
  const submitDeclineFeedback = async () => {
    try {
      await axios.post('http://localhost:8080/api/policies/intent', {
        policyId: selectedDeclinePolicyId,
        status: 'DECLINED',
        ignoreReason: declineReason
      }, {
        params: { username }
      });

      // 백엔드 알고리즘 피드백 순위 반영 적용하여 리스트 재조회
      fetchSavedPolicies(username);
      setShowDeclineModal(false);
      fetchDDayAlerts(username);
    } catch (err) {
      console.error('피드백 저장 실패:', err);
    }
  };

  // 12. 링크 클릭 시 신청중(IN_PROGRESS) 자동 업그레이드 비동기 처리
  const handleLinkClick = async (policyId) => {
    try {
      await axios.post('http://localhost:8080/api/policies/intent', {
        policyId: policyId,
        status: 'IN_PROGRESS',
        ignoreReason: ''
      }, {
        params: { username }
      });
      fetchSavedPolicies(username);
      fetchDDayAlerts(username);
    } catch (err) {
      console.error('자동 상태 전환 실패:', err);
    }
  };

  // 특수사항 다중 선택 토글 핸들러
  const handleSpecialChange = (value) => {
    if (special.includes(value)) {
      setSpecial(special.filter((item) => item !== value));
    } else {
      setSpecial([...special, value]);
    }
  };

  // 혜택이 적은 카테고리인지 여부 판별
  const isLowBenefitCategory = (category) => {
    return category === '교육' || category === '참여/권리' || category === '복지/문화' || category === '복지';
  };

  // HSL 색상 해시 함수 (카테고리 태그별 고유 컬러)
  const getCategoryColor = (category) => {
    switch (category) {
      case '주거': return 'hsl(215, 80%, 60%)';
      case '일자리': return 'hsl(145, 75%, 45%)';
      case '교육': return 'hsl(35, 85%, 55%)';
      case '복지/문화': return 'hsl(280, 70%, 65%)';
      default: return 'hsl(170, 75%, 50%)';
    }
  };

  // 마크다운 ** 굵은 글씨 파서
  const parseBoldMarkdown = (text) => {
    if (!text) return '';
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="highlighted-keyword">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  // 현재 활성화된 탭 기준으로 카드 리스트 필터링
  // DECLINED(안함) 및 CANNOT_APPLY(신청못함)은 대시보드 전체(전체매칭/추천) 노출에서 제외하되,
  // 신청예정 탭에서만 CANNOT_APPLY가 다른 상태들과 함께 보이도록 함
  const filteredPolicies = policies.filter((p) => {
    if (p.userStatus === 'DECLINED') return false; // 일반 거절은 아예 미노출
    if (isPolicyExpired(p)) return false; // 💡 [마감 공고 전면 격리] 마감 정책은 대시보드 리스트에서 완전 배제
    
    if (currentTab === 'ALL') {
      return p.userStatus !== 'CANNOT_APPLY';
    }
    if (currentTab === 'RECOMMENDED') {
      return p.userStatus === 'RECOMMENDED';
    }
    if (currentTab === 'PLANNING') {
      return ['PLANNING', 'IN_PROGRESS', 'CANNOT_APPLY'].includes(p.userStatus);
    }
    if (currentTab === 'APPLIED') {
      return p.userStatus === 'APPLIED';
    }
    return true;
  });

  // 개별 정책 카드 렌더링 함수
  const renderPolicyCard = (policy, index) => {
    // 마감일 D-day 텍스트 계산
    let ddayText = '';
    let isUrgent = false;
    if (policy.end_date && policy.end_date !== 'unknown') {
      const end = parseLastDate(policy.end_date);
      if (end) {
        try {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          end.setHours(0, 0, 0, 0);
          const diffTime = end.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays === 0) {
            ddayText = 'D-Day (오늘마감)';
            isUrgent = true;
          } else if (diffDays > 0) {
            ddayText = `D-${diffDays}`;
            if (diffDays <= 7) isUrgent = true; // D-7 이하 빨간색 강조
          } else {
            ddayText = '마감됨';
          }
        } catch (e) {
          ddayText = '';
        }
      } else {
        // '상시신청' 등의 경우 '마감됨'을 출력하지 않고 '상시' 혹은 빈칸 처리
        ddayText = policy.end_date.includes('상시') ? '상시' : '';
      }
    }

    // 혜택 부족 정렬 페널티가 부여되었는지 체크
    const isPenalized = isLowBenefitCategory(policy.interest) && policies.some(p => p.userStatus === 'DECLINED' && p.ignoreReason?.includes('혜택'));

    const generalLink = getGeneralLinkOnly(policy);
    const detailLink = getDetailLinkOnly(policy);

    return (
      <article 
        key={index} 
        className="policy-card glass-hover fade-in" 
        title={generalLink || '공식 신청 링크 준비 중'}
        style={{ 
          animationDelay: `${index * 100}ms`,
          cursor: 'pointer'
        }}
        onMouseUp={(e) => {
          // 1. 드래그 챗봇 질문 플로팅 핸들러
          handleTextSelection(e, {
            policyId: policy.policyId,
            policyName: policy.policy_name,
            reason: policy.reason,
            eligibility: policy.eligibility,
            applyMethod: policy.apply_method || policy.applyMethod,
            requiredDocuments: policy.required_documents || policy.requiredDocuments,
            endDate: policy.end_date || policy.endDate
          });
        }}
        onClick={(e) => {
          // 2. 카드 전체 클릭 공식 사이트 새 탭 연결 핸들러
          handleCardClick(e, policy);
        }}
      >
        <div className="card-top">
          <span 
            className="category-badge" 
            style={{ 
              backgroundColor: `${getCategoryColor(policy.interest)}1a`, 
              color: getCategoryColor(policy.interest),
              borderColor: `${getCategoryColor(policy.interest)}4d`
            }}
          >
            {policy.interest || '청년정책'}
          </span>
          <div className="card-top-badges" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', width: '100%', justifyContent: 'flex-end' }}>
            {isPenalized && (
              <span className="dday-badge" style={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)' }} title="혜택 부족 피드백이 반영되어 노출 순위가 조정되었습니다.">
                📉 피드백 조정됨
              </span>
            )}
            {ddayText && (
              <span className={`dday-badge ${isUrgent ? 'urgent' : ''}`}>
                {ddayText}
              </span>
            )}
            {policy.match_rate !== undefined && (
              <span className="match-rate-badge" style={{
                backgroundColor: policy.match_rate >= 80 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(156, 163, 175, 0.15)',
                color: policy.match_rate >= 80 ? '#10b981' : '#9ca3af',
                borderColor: policy.match_rate >= 80 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(156, 163, 175, 0.3)',
                fontWeight: 'bold',
                border: '1px solid',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.75rem'
              }}>
                🎯 정확도 {policy.match_rate}%
              </span>
            )}
            {policy.region && policy.region !== 'unknown' && (
              <span className="region-badge">📍 {policy.region}</span>
            )}
            
            {/* 🤖 이 공고 대상 AI 질문 상시 버튼 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAskAboutPolicy({
                  policyId: policy.policyId,
                  policyName: policy.policy_name,
                  reason: policy.reason,
                  eligibility: policy.eligibility,
                  applyMethod: policy.apply_method || policy.applyMethod,
                  requiredDocuments: policy.required_documents || policy.requiredDocuments,
                  endDate: policy.end_date || policy.endDate
                });
              }}
              style={{
                background: 'rgba(99, 102, 241, 0.18)',
                color: '#a5b4fc',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s ease',
              }}
              className="chatbot-card-ask-btn"
              title="이 공고에 대해 AI 챗봇에게 바로 질문하기"
            >
              🤖 AI에게 질문
            </button>
          </div>
        </div>
        
        <h3 className="card-title">{policy.policy_name}</h3>

        {/* 🔗 마우스 호버 시 활성화되는 링크 정보 배지 */}
        <div className="hover-link-badge">
          🔗 일반링크: {generalLink || '없음'}
        </div>

        {/* 현재 상태 정보 안내 태그 */}
        {(policy.userStatus === 'IN_PROGRESS' || policy.userStatus === 'APPLIED' || policy.userStatus === 'CANNOT_APPLY') && (
          <div className="status-progress-banner" style={{
            fontSize: '11px',
            background: policy.userStatus === 'IN_PROGRESS' ? 'rgba(245,158,11,0.1)' : 
                        policy.userStatus === 'CANNOT_APPLY' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
            color: policy.userStatus === 'IN_PROGRESS' ? '#fbbf24' : 
                   policy.userStatus === 'CANNOT_APPLY' ? '#fca5a5' : '#4ade80',
            border: `1px solid ${policy.userStatus === 'IN_PROGRESS' ? 'rgba(245,158,11,0.2)' : 
                                 policy.userStatus === 'CANNOT_APPLY' ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
            padding: '6px 12px',
            borderRadius: '8px',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            width: 'max-content'
          }}>
            {policy.userStatus === 'IN_PROGRESS' ? '📝 현재 공식 사이트 지원 진행 중' : 
             policy.userStatus === 'CANNOT_APPLY' ? '❌ 자격 조건 외 기타 사유로 신청 못함' : '✅ 지원 최종 완료'}
          </div>
        )}
        
        <div className="card-section ai-rationale">
          <h4 className="section-label">🧠 AI 추천 근거</h4>
          <p className="section-text">{parseBoldMarkdown(policy.reason)}</p>
        </div>

        <div className="card-section eligibility">
          <h4 className="section-label">📋 자격 요건 원문 요약</h4>
          <p className="section-text pre-wrap-text">{policy.eligibility}</p>
        </div>

        {/* 📂 제출 필요 서류 대조 분석 영역 */}
        <div className="card-section document-comparison">
          <h4 className="section-label">📄 필요 서류 사전 검증</h4>
          {policy.required_documents && policy.required_documents.length > 0 ? (
            <div className="docs-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
              {policy.ownedDocuments && policy.ownedDocuments.map((doc, dIdx) => (
                <span key={`owned-${dIdx}`} className="doc-tag owned" style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(34, 197, 94, 0.08)',
                  color: '#4ade80',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}>
                  <input type="checkbox" checked={true} disabled style={{ accentColor: '#22c55e', margin: 0, cursor: 'default', width: '13px', height: '13px' }} />
                  <span>{doc}</span>
                </span>
              ))}
              {policy.missingDocuments && policy.missingDocuments.map((doc, dIdx) => (
                <span key={`missing-${dIdx}`} className="doc-tag missing" style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}>
                  <span style={{ color: '#f87171', fontSize: '11px', display: 'flex', alignItems: 'center' }}>⚠️</span>
                  <span>{doc}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="section-text font-italic text-muted" style={{ fontSize: '12px' }}>필요 서류 없음 또는 파악 불가</p>
          )}
        </div>

        {/* 신청 방법 및 세부 안내 */}
        {policy.apply_method && policy.apply_method !== '정보 없음' && (
          <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '15px' }}>
            <div style={{ 
              padding: '10px 12px', 
              borderRadius: '6px', 
              backgroundColor: 'rgba(255, 255, 255, 0.02)', 
              borderLeft: '3px solid #6366f1',
              textAlign: 'left'
            }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#818cf8', marginBottom: '4px' }}>📋 신청 방법 및 세부 안내</div>
              <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}>
                {policy.apply_method}
              </div>
            </div>
          </div>
        )}

        <div className="card-meta" style={{ marginTop: '15px', paddingTop: '12px', borderTop: '1px dashed rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {policy.agency && policy.agency !== '정보 없음' && (
            <div className="meta-item" style={{ width: '100%' }}>
              <strong>신청기관:</strong> {policy.agency}
            </div>
          )}
          <div className="meta-item" style={{ width: '100%' }}>
            <strong>마감기한:</strong> {policy.end_date === 'unknown' ? '상시/미정' : policy.end_date}
          </div>
        </div>

        {generalLink && isBaseLinkFormat(generalLink) && detailLink && detailLink !== generalLink && (
          <button
            className="detail-link-btn"
            style={{
              width: '100%',
              marginTop: '12px',
              padding: '9px 12px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
              color: '#ffffff',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              cursor: 'pointer',
              fontSize: '11.5px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)',
              transition: 'all 0.2s ease',
              zIndex: 10
            }}
            onClick={(e) => {
              e.stopPropagation();
              window.open(detailLink, '_blank', 'noopener,noreferrer');
              handleLinkClick(policy.policyId);
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            🔍 정책 상세 페이지 바로가기 (상세링크)
          </button>
        )}

        {/* 🎯 신청 상태 관리 (추천 상태에서는 단순화, 신청예정 단계로 진입 후에는 4대 상태 정밀 제어) */}
        <div className="status-control-section" style={{ marginTop: '12px' }}>
          <span className="control-label" style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
            신청 상태 변경
          </span>
          <div className="status-btn-group-simple" style={{ display: 'flex', gap: '6px' }}>
            {policy.userStatus === 'RECOMMENDED' && (
              <>
                <button 
                  className="status-btn plan"
                  style={{
                    flex: 1,
                    background: 'rgba(99, 102, 241, 0.12)',
                    color: '#818cf8',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '11.5px',
                    fontWeight: '600'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChange(policy.policyId, 'PLANNING');
                  }}
                >
                  ⭕ 신청예정
                </button>
                <button 
                  className="status-btn decline"
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#fca5a5',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '11.5px',
                    fontWeight: '600'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChange(policy.policyId, 'DECLINED');
                  }}
                >
                  ❌ 안함
                </button>
              </>
            )}

            {['PLANNING', 'IN_PROGRESS', 'CANNOT_APPLY', 'APPLIED'].includes(policy.userStatus) && (
              <div style={{ display: 'flex', gap: '5px', width: '100%' }}>
                <button 
                  className={`status-btn ${policy.userStatus === 'PLANNING' ? 'active' : ''}`}
                  style={{
                    flex: 1,
                    background: policy.userStatus === 'PLANNING' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                    color: policy.userStatus === 'PLANNING' ? '#a5b4fc' : '#cbd5e1',
                    border: `1px solid ${policy.userStatus === 'PLANNING' ? 'rgba(99, 102, 241, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
                    padding: '8px 2px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '600',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChange(policy.policyId, 'PLANNING');
                  }}
                >
                  ⭕ 예정
                </button>
                <button 
                  className={`status-btn ${policy.userStatus === 'IN_PROGRESS' ? 'active' : ''}`}
                  style={{
                    flex: 1,
                    background: policy.userStatus === 'IN_PROGRESS' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                    color: policy.userStatus === 'IN_PROGRESS' ? '#fde047' : '#cbd5e1',
                    border: `1px solid ${policy.userStatus === 'IN_PROGRESS' ? 'rgba(245, 158, 11, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
                    padding: '8px 2px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '600',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChange(policy.policyId, 'IN_PROGRESS');
                  }}
                >
                  📝 신청중
                </button>
                <button 
                  className={`status-btn ${policy.userStatus === 'CANNOT_APPLY' ? 'active' : ''}`}
                  style={{
                    flex: 1,
                    background: policy.userStatus === 'CANNOT_APPLY' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                    color: policy.userStatus === 'CANNOT_APPLY' ? '#fca5a5' : '#cbd5e1',
                    border: `1px solid ${policy.userStatus === 'CANNOT_APPLY' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
                    padding: '8px 2px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '600',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChange(policy.policyId, 'CANNOT_APPLY');
                  }}
                >
                  ❌ 못함
                </button>
                <button 
                  className={`status-btn ${policy.userStatus === 'APPLIED' ? 'active' : ''}`}
                  style={{
                    flex: 1,
                    background: policy.userStatus === 'APPLIED' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                    color: policy.userStatus === 'APPLIED' ? '#86efac' : '#cbd5e1',
                    border: `1px solid ${policy.userStatus === 'APPLIED' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
                    padding: '8px 2px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '600',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChange(policy.policyId, 'APPLIED');
                  }}
                >
                  ✅ 완료
                </button>
              </div>
            )}
          </div>
        </div>
      </article>
    );
  };

  // Render Login Card if not logged in
  if (!isLoggedIn) {
    return (
      <div className="login-overlay">
        <div className="login-card glass fade-in">
          <div className="login-header">
            <span className="badge">Gov24 Plus Auth</span>
            <h2>Gov24 <span className="gradient-text">Plus</span></h2>
            <p>맞춤형 청년 정책 자동 매칭 & RAG 시스템</p>
          </div>
          
          <div className="auth-tabs">
            <button className={`auth-tab-btn ${authMode === 'login' ? 'active' : ''}`} onClick={() => setAuthMode('login')}>로그인</button>
            <button className={`auth-tab-btn ${authMode === 'register' ? 'active' : ''}`} onClick={() => setAuthMode('register')}>회원가입</button>
          </div>
          
          {authError && <div className="auth-error-msg">⚠️ {authError}</div>}
          {authSuccess && <div className="auth-success-msg">✔️ {authSuccess}</div>}

          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="auth-form">
              <div className="form-group">
                <label>아이디 (Username)</label>
                <input 
                  type="text" 
                  value={loginUsername} 
                  onChange={(e) => setLoginUsername(e.target.value)} 
                  placeholder="아이디를 입력하세요" 
                  required
                />
              </div>
              <div className="form-group">
                <label>비밀번호 (Password)</label>
                <input 
                  type="password" 
                  value={loginPassword} 
                  onChange={(e) => setLoginPassword(e.target.value)} 
                  placeholder="비밀번호를 입력하세요" 
                  required
                />
              </div>
              <button type="submit" className="submit-btn" disabled={authLoading}>
                {authLoading ? <span className="spinner-loader"></span> : '🔓 로그인'}
              </button>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', fontSize: '12px' }}>
                <span 
                  onClick={() => { setShowFindModal('id'); setFindErrorMsg(null); setFindSuccessMsg(null); }} 
                  style={{ color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  🔍 아이디 찾기
                </span>
                <span 
                  onClick={() => { setShowFindModal('pw'); setFindErrorMsg(null); setFindSuccessMsg(null); }} 
                  style={{ color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  🔑 비밀번호 재설정
                </span>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="auth-form">
              <div className="form-group">
                <label>새 아이디</label>
                <input 
                  type="text" 
                  value={registerUsername} 
                  onChange={(e) => setRegisterUsername(e.target.value)} 
                  placeholder="새 아이디를 입력하세요" 
                  required
                />
              </div>
              <div className="form-group">
                <label>새 비밀번호</label>
                <input 
                  type="password" 
                  value={registerPassword} 
                  onChange={(e) => setRegisterPassword(e.target.value)} 
                  placeholder="새 비밀번호를 입력하세요" 
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>복구용 이메일 주소</label>
                <input 
                  type="email" 
                  value={registerEmail} 
                  onChange={(e) => setRegisterEmail(e.target.value)} 
                  placeholder="인증코드를 수신할 이메일을 적으세요" 
                  required
                />
              </div>
              <button type="submit" className="submit-btn" disabled={authLoading}>
                {authLoading ? <span className="spinner-loader"></span> : '✨ 회원가입 하기'}
              </button>
            </form>
          )}
          
          {/* 📧 아이디 찾기 / 비밀번호 재설정 통합 모달 */}
          {showFindModal && (
            <div className="find-modal-overlay" style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              backdropFilter: 'blur(8px)'
            }}>
              <div className="find-modal-card glass" style={{
                width: '100%',
                maxWidth: '420px',
                padding: '30px',
                boxSizing: 'border-box',
                position: 'relative'
              }}>
                <button 
                  onClick={closeFindModal}
                  style={{
                    position: 'absolute',
                    top: '15px',
                    right: '15px',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: '20px',
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>
                
                <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: 'bold' }}>
                  {showFindModal === 'id' ? '🔍 이메일로 아이디 찾기' : '🔑 비밀번호 재설정'}
                </h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '12.5px', color: '#94a3b8', lineHeight: '1.4' }}>
                  {showFindModal === 'id' 
                    ? '가입 시 입력했던 이메일을 적고 인증코드를 전송받으세요.' 
                    : '아이디와 가입 이메일을 입력한 뒤 인증코드를 전송받아 비밀번호를 변경하세요.'}
                </p>

                {findErrorMsg && <div style={{ color: '#fca5a5', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '10px', borderRadius: '8px', fontSize: '12px', marginBottom: '15px' }}>⚠️ {findErrorMsg}</div>}
                {findSuccessMsg && <div style={{ color: '#86efac', background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.25)', padding: '10px', borderRadius: '8px', fontSize: '12px', marginBottom: '15px' }}>✔️ {findSuccessMsg}</div>}

                {showFindModal === 'id' ? (
                  // 아이디 찾기 폼
                  <div>
                    {!foundUsername ? (
                      <form onSubmit={isCodeSent ? handleVerifyCodeForFindId : handleSendCodeForFindId}>
                        <div className="form-group" style={{ marginBottom: '12px' }}>
                          <label>이메일 주소</label>
                          <input 
                            type="email" 
                            value={findEmail}
                            onChange={(e) => setFindEmail(e.target.value)}
                            placeholder="가입했던 이메일을 입력하세요"
                            disabled={isCodeSent}
                            required
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'white', boxSizing: 'border-box' }}
                          />
                        </div>

                        {isCodeSent && (
                          <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label>인증코드 (6자리)</label>
                            <input 
                              type="text" 
                              value={findCode}
                              onChange={(e) => setFindCode(e.target.value)}
                              placeholder="백엔드 콘솔의 6자리 코드 기입"
                              required
                              maxLength={6}
                              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'white', boxSizing: 'border-box' }}
                            />
                          </div>
                        )}

                        <button type="submit" className="submit-btn" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
                          {isCodeSent ? '🔑 인증 완료 및 아이디 찾기' : '📧 인증코드 발송'}
                        </button>
                      </form>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <p style={{ fontSize: '14px', color: '#cbd5e1' }}>조회된 사용자님의 아이디는 다음과 같습니다.</p>
                        <h4 style={{ fontSize: '24px', fontWeight: 'bold', color: '#a855f7', margin: '15px 0' }}>
                          {foundUsername}
                        </h4>
                        <button 
                          onClick={() => {
                            setLoginUsername(foundUsername);
                            closeFindModal();
                          }}
                          className="submit-btn" 
                          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          이 아이디로 로그인하기
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  // 비밀번호 재설정 폼
                  <form onSubmit={isCodeSent ? handleResetPasswordSubmit : handleSendCodeForResetPw}>
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label>아이디 (Username)</label>
                      <input 
                        type="text" 
                        value={findUsernameVal}
                        onChange={(e) => setFindUsernameVal(e.target.value)}
                        placeholder="아이디를 입력하세요"
                        disabled={isCodeSent}
                        required
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'white', boxSizing: 'border-box' }}
                      />
                    </div>
                    
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label>이메일 주소</label>
                      <input 
                        type="email" 
                        value={findEmail}
                        onChange={(e) => setFindEmail(e.target.value)}
                        placeholder="가입했던 이메일을 입력하세요"
                        disabled={isCodeSent}
                        required
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'white', boxSizing: 'border-box' }}
                      />
                    </div>

                    {isCodeSent && (
                      <>
                        <div className="form-group" style={{ marginBottom: '12px' }}>
                          <label>인증코드 (6자리)</label>
                          <input 
                            type="text" 
                            value={findCode}
                            onChange={(e) => setFindCode(e.target.value)}
                            placeholder="백엔드 콘솔의 6자리 코드 기입"
                            required
                            maxLength={6}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'white', boxSizing: 'border-box' }}
                          />
                        </div>
                        
                        <div className="form-group" style={{ marginBottom: '15px' }}>
                          <label>새 비밀번호</label>
                          <input 
                            type="password" 
                            value={resetNewPassword}
                            onChange={(e) => setResetNewPassword(e.target.value)}
                            placeholder="새로 설정할 비밀번호를 입력하세요"
                            required
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'white', boxSizing: 'border-box' }}
                          />
                        </div>
                      </>
                    )}

                    <button type="submit" className="submit-btn" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
                      {isCodeSent ? '🔒 비밀번호 재설정 완료' : '📧 인증코드 발송'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* 🚀 Header */}
      <header className="app-header">
        <div className="logo-section">
          <span className="badge">AI RAG & MySQL Hybrid v3</span>
          <h1>Gov24 <span className="gradient-text">Plus</span></h1>
          <p className="subtitle">전국 청년 맞춤형 정책 자동 매칭 & AI 분석, 서류 자동 대조 및 마감 스마트 알림 서비스</p>
          <div className="profile-greeting">
            👤 <strong>{username}</strong>님 환영합니다! 본인 전용 보관함과 필터링 설정이 적용 중입니다.
          </div>
        </div>
      </header>

      {/* 🧭 Top Tab Navigation Menu */}
      <nav className="top-nav-menu">
        <button className={`nav-menu-btn ${activeMenu === 'DASHBOARD' ? 'active' : ''}`} onClick={() => setActiveMenu('DASHBOARD')}>
          🏠 대시보드
        </button>
        <button className={`nav-menu-btn ${activeMenu === 'FEEDBACK' ? 'active' : ''}`} onClick={() => setActiveMenu('FEEDBACK')}>
          🧠 AI 피드백 루프
        </button>
        <button className={`nav-menu-btn ${activeMenu === 'PROFILE' ? 'active' : ''}`} onClick={() => setActiveMenu('PROFILE')}>
          👤 프로필 설정 (온보딩)
        </button>
        {/* 🤖 챗봇 비서 상시 열기 버튼 */}
        <button 
          className={`nav-menu-btn ${showChatbot ? 'active' : ''}`} 
          onClick={() => setShowChatbot(!showChatbot)}
          style={{ 
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(79, 70, 229, 0.15) 100%)', 
            color: '#a5b4fc', 
            border: '1px solid rgba(99, 102, 241, 0.3)',
            fontWeight: 'bold'
          }}
        >
          🤖 AI 챗봇 비서
        </button>
        <button className="nav-menu-btn logout-btn" onClick={handleLogout}>
          🚪 로그아웃
        </button>
      </nav>

      {/* ⏰ D-day 마감 임박 알림 센터 */}
      {alerts.length > 0 && activeMenu === 'DASHBOARD' && (
        <div className="alert-banner fade-in">
          <span className="alert-icon">🔔</span>
          <div className="alert-content-wrapper">
            <strong>[신청 마감 임박 알림]</strong> 신청 예정 혹은 진행 중인 정책 중 {alerts.length}건의 신청 마감이 임박했습니다!
            <div className="alert-items">
              {alerts.map((alert, idx) => (
                <span key={idx} className="alert-item-tag">
                  {alert.title} (D-{alert.daysLeft})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🧩 Dynamic Menu Layout rendering */}
      {activeMenu === 'DASHBOARD' && (
        <div className="dashboard-layout fade-in">
          {/* 🤖 AI 챗봇 상시 질문 배너 */}
          <div 
            className="chatbot-welcome-banner" 
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(79, 70, 229, 0.05) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '2rem' }}>🤖</span>
              <div>
                <strong style={{ color: '#c7d2fe', fontSize: '14.5px', display: 'block', marginBottom: '4px' }}>궁금한 청년 정책이나 복잡한 행정 서류가 있으신가요?</strong>
                <span style={{ color: '#94a3b8', fontSize: '12px', lineHeight: '1.4' }}>
                  공고문의 특정 문장을 마우스로 <strong>드래그</strong>하여 상세 확인을 하거나, 언제든지 우측/상단의 챗봇 비서를 통해 질문해 보세요!
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowChatbot(true)}
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.3)',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              💬 AI 비서에게 질문하기
            </button>
          </div>

          {/* 🛠️ 캡스톤 최종 발표 시연 및 테스트용 제어판 */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(245, 158, 11, 0.04) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <strong style={{ color: '#fcd34d', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  🛠️ 캡스톤 최종 발표 데모 & 알림 테스트 제어판
                </strong>
                <span style={{ color: '#94a3b8', fontSize: '12px', lineHeight: '1.4' }}>
                  발표 시연 시 10분 내에 모든 흐름(다중 조건 매칭, 스마트 마감 알림, KakaoTalk 알림톡 연동)을 즉시 보여주기 위한 단축 제어 장치입니다.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={injectFakePolicyForDemo}
                  style={{
                    background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
                    color: '#0f172a',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.2)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  🎯 1초 다중매칭 정책 주입 (+알림 연동)
                </button>
                <button
                  type="button"
                  onClick={triggerNotificationSimulation}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  🔔 마감 알림창 즉시 강제 발송
                </button>
                <button
                  type="button"
                  onClick={() => {
                    alert("실제 DB 마감 알림 테스트 가이드:\n\n" +
                          "1. 대시보드의 아무 공고 카드에서 'O(신청예정)' 또는 '지원도중' 버튼을 클릭합니다.\n" +
                          "2. MySQL DB에서 다음 SQL 쿼리를 실행해 해당 공고의 마감 기한을 오늘 또는 내일로 강제 변경합니다:\n" +
                          "   UPDATE policies SET end_date = '2026-06-09' WHERE id = [공고ID];\n" +
                          "3. 본 플랫폼 페이지를 새로고침하거나 로그아웃 후 다시 로그인합니다.\n" +
                          "4. 백엔드 스케줄러 및 프론트엔드 연동에 의해 데스크톱 브라우저 알림과 노란색 카카오톡 알림톡 팝업이 실시간 가동됩니다.");
                  }}
                  style={{
                    background: 'transparent',
                    color: '#94a3b8',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  ℹ️ DB 연동 테스트 방법
                </button>
              </div>
            </div>
          </div>

          {/* 📊 Tabs Navigation Filter */}
          <div className="results-header-container">
            <div className="results-header">
              <h2 className="panel-title">📊 맞춤형 청년 정책 대시보드</h2>
              <div className="results-indicator">
                {filteredPolicies.length > 0 && <span className="status-badge green">{filteredPolicies.length}건 노출</span>}
              </div>
            </div>
            
            <div className="tab-bar">
              <button className={`tab-btn ${currentTab === 'ALL' ? 'active' : ''}`} onClick={() => setCurrentTab('ALL')}>
                전체 매칭 ({policies.filter(p => p.userStatus !== 'DECLINED' && p.userStatus !== 'CANNOT_APPLY').length})
              </button>
              <button className={`tab-btn ${currentTab === 'RECOMMENDED' ? 'active' : ''}`} onClick={() => setCurrentTab('RECOMMENDED')}>
                추천 ({policies.filter(p => p.userStatus === 'RECOMMENDED').length})
              </button>
              <button className={`tab-btn ${currentTab === 'PLANNING' ? 'active' : ''}`} onClick={() => setCurrentTab('PLANNING')}>
                신청예정 ({policies.filter(p => ['PLANNING', 'IN_PROGRESS', 'CANNOT_APPLY'].includes(p.userStatus)).length})
              </button>
              <button className={`tab-btn ${currentTab === 'APPLIED' ? 'active' : ''}`} onClick={() => setCurrentTab('APPLIED')}>
                신청완료 ({policies.filter(p => p.userStatus === 'APPLIED').length})
              </button>
            </div>
          </div>

          {!searched && (
            <div className="empty-state glass">
              <div className="empty-icon">👤</div>
              <h3>프로필 정보 미설정</h3>
              <p>상단 메뉴의 <strong>[프로필 설정 (온보딩)]</strong>에서 본인의 나이, 지역, 취업, 소득 등의 8대 조건을 맞추고 저장하시면 맞춤 RAG 매칭이 분석됩니다.</p>
            </div>
          )}

          {error && (
            <div className="error-state glass">
              <div className="error-icon">⚠️</div>
              <h3>연동 에러 발생</h3>
              <p>{error}</p>
            </div>
          )}

          {searched && !loading && !error && filteredPolicies.length === 0 && (
            <div className="empty-state glass">
              <div className="empty-icon">🔍</div>
              <h3>해당 탭에 정책이 존재하지 않습니다</h3>
              <p>이 탭에 설정된 정책이 없거나, 조건에 맞는 새로운 정책을 추가 추천받으시기 바랍니다.</p>
            </div>
          )}

          {searched && !loading && !error && filteredPolicies.length > 0 && (
            <div className="policy-sections-container">
              {filteredPolicies.filter(p => p.match_rate >= 80).length > 0 && (
                <div className="policy-section-group" style={{ marginBottom: '40px' }}>
                  <h3 className="policy-section-title high-match-title" style={{
                    fontSize: '1.25rem',
                    color: '#10b981',
                    marginBottom: '16px',
                    borderLeft: '4px solid #10b981',
                    paddingLeft: '10px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>🥇 핵심 맞춤 정책 (추천 정확도 80% 이상)</h3>
                  <div className="cards-grid">
                    {filteredPolicies.filter(p => p.match_rate >= 80).map((policy, idx) => renderPolicyCard(policy, idx))}
                  </div>
                </div>
              )}
              
              {filteredPolicies.filter(p => p.match_rate < 80).length > 0 && (
                <div className="policy-section-group">
                  <h3 className="policy-section-title low-match-title" style={{
                    fontSize: '1.25rem',
                    color: '#9ca3af',
                    marginBottom: '16px',
                    borderLeft: '4px solid #9ca3af',
                    paddingLeft: '10px',
                    fontWeight: 'bold',
                    marginTop: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>🥈 일반 추천 정책 (추천 정확도 80% 미만)</h3>
                  <div className="cards-grid">
                    {filteredPolicies.filter(p => p.match_rate < 80).map((policy, idx) => renderPolicyCard(policy, idx + filteredPolicies.filter(p => p.match_rate >= 80).length))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 🚫 자동분류된 조건 불가 정책 섹션 (접기/펼치기 가능) */}
          {searched && !loading && !error && filteredOutPolicies.length > 0 && (
            <details className="filtered-out-section glass" style={{
              marginTop: '30px',
              borderRadius: '16px',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              padding: '0',
              overflow: 'hidden'
            }}>
              <summary style={{
                cursor: 'pointer',
                padding: '18px 24px',
                fontSize: '1.1rem',
                fontWeight: '700',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                userSelect: 'none',
                borderBottom: '1px solid rgba(239, 68, 68, 0.1)',
                background: 'rgba(239, 68, 68, 0.05)',
                listStyle: 'none'
              }}>
                <span style={{ fontSize: '1.2rem' }}>🚫</span>
                AI 자동분류 — 조건 불가 판정 정책 ({filteredOutPolicies.length}건)
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '0.8rem',
                  color: '#94a3b8',
                  fontWeight: '400'
                }}>클릭하여 펼치기 — AI 오분류 확인용</span>
              </summary>
              <div style={{ padding: '16px 24px' }}>
                <p style={{
                  fontSize: '0.82rem',
                  color: '#94a3b8',
                  marginBottom: '16px',
                  lineHeight: '1.6',
                  borderLeft: '3px solid #f59e0b',
                  paddingLeft: '12px',
                  background: 'rgba(245, 158, 11, 0.05)',
                  padding: '10px 12px',
                  borderRadius: '0 8px 8px 0'
                }}>
                  ⚠️ 아래 정책들은 AI가 <strong>나이·마감기한 외 기타 조건</strong>(학적, 소득, 취업상태, 지역 등)으로 부적합 판정한 항목입니다.
                  <br/>AI 판단이 틀렸을 수 있으므로, 직접 확인 후 해당 정책이 본인에게 맞다면 정부24에서 직접 검색해 지원하세요.
                </p>
                <div style={{
                  display: 'grid',
                  gap: '8px'
                }}>
                  {filteredOutPolicies.map((fp, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px 16px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                    >
                      <span style={{
                        fontSize: '0.75rem',
                        color: '#64748b',
                        fontWeight: '700',
                        minWidth: '28px',
                        textAlign: 'center',
                        padding: '2px 0',
                        flexShrink: 0
                      }}>#{idx + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.92rem',
                          fontWeight: '600',
                          color: '#e2e8f0',
                          marginBottom: '4px',
                          wordBreak: 'keep-all'
                        }}>{fp.policy_name}</div>
                        <div style={{
                          fontSize: '0.8rem',
                          color: '#ef4444',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '4px'
                        }}>
                          <span style={{ flexShrink: 0 }}>❌</span>
                          <span>{fp.reject_reason}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          )}
        </div>
      )}

      {activeMenu === 'FEEDBACK' && (
        <div className="feedback-layout fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* 🧠 AI 개인화 피드백 루프 패널 */}
          <section className="form-panel glass feedback-engine" style={{ padding: '24px' }}>
            <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              🧠 AI 개인화 피드백 루프
            </h2>
            <p className="panel-subtitle">사용자가 제출한 거절 피드백(사유) 및 성향 정보를 수렴하여, 추천 알고리즘의 매칭 가중치를 동적으로 조율하고 있습니다.</p>
            
            <div className="engine-status-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
              <div className="engine-status-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="status-dot green" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }}></span>
                <span className="status-text" style={{ fontSize: '13px', color: '#e2e8f0' }}>온보딩 서류 상태 연계 실시간 필터링 활성화</span>
              </div>
              
              {/* 요건 불합치 피드백 상태 파악 */}
              {policies.some(p => p.userStatus === 'DECLINED' && p.ignoreReason?.includes('대상에 해당되지')) ? (
                <div className="engine-status-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="status-dot orange" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f97316', boxShadow: '0 0 8px #f97316' }}></span>
                  <span className="status-text" style={{ fontSize: '13px', color: '#e2e8f0' }}><strong>[요건 불합치 반영]</strong> 부적합 공고는 대시보드에서 100% 자동 제외 필터링 적용 중</span>
                </div>
              ) : (
                <div className="engine-status-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="status-dot green" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }}></span>
                  <span className="status-text" style={{ fontSize: '13px', color: '#e2e8f0' }}>요건 미달 공고 제외 대기 중 (피드백 학습 준비 완료)</span>
                </div>
              )}

              {/* 혜택 부족 피드백 정렬 상태 파악 */}
              {policies.some(p => p.userStatus === 'DECLINED' && p.ignoreReason?.includes('혜택')) ? (
                <div className="engine-status-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="status-dot orange" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f97316', boxShadow: '0 0 8px #f97316' }}></span>
                  <span className="status-text" style={{ fontSize: '13px', color: '#e2e8f0' }}><strong>[혜택 부족 반영]</strong> 소액 혜택 정책(교육/문화 등)에 대한 정렬 가중치 페널티 적용 중</span>
                </div>
              ) : (
                <div className="engine-status-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="status-dot green" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }}></span>
                  <span className="status-text" style={{ fontSize: '13px', color: '#e2e8f0' }}>혜택 규모 기반 정렬 정상 가동 중</span>
                </div>
              )}

              <div className="engine-stats" style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <div className="stat-box" style={{ flex: 1, padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', textAlign: 'center' }}>
                  <span className="stat-num" style={{ display: 'block', fontSize: '20px', fontWeight: 'bold', color: '#818cf8' }}>{ownedDocuments.length}개</span>
                  <span className="stat-lbl" style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>선택된 보유 서류</span>
                </div>
                <div className="stat-box" style={{ flex: 1, padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', textAlign: 'center' }}>
                  <span className="stat-num" style={{ display: 'block', fontSize: '20px', fontWeight: 'bold', color: '#f43f5e' }}>{policies.filter(p => p.userStatus === 'DECLINED').length}건</span>
                  <span className="stat-lbl" style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>거절 피드백 수렴</span>
                </div>
              </div>

              {/* 🧠 AI 개인화 성향 요약 리포트 카드 */}
              <div className="ai-report-card" style={{
                marginTop: '24px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                paddingTop: '20px',
                textAlign: 'left'
              }}>
                <h4 style={{
                  fontSize: '13.5px',
                  color: '#818cf8',
                  fontWeight: '700',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  margin: 0
                }}>
                  📊 AI 분석 유저 성향 리포트
                </h4>
                <div style={{
                  background: 'rgba(15, 23, 42, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  fontSize: '13px',
                  lineHeight: '1.65',
                  color: '#e2e8f0',
                  whiteSpace: 'pre-wrap'
                }}>
                  {parseAiPersonalizationSummaryMarkdown(getAiPersonalizationSummary())}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}


      {activeMenu === 'PROFILE' && (
        <div className="profile-layout fade-in">
          {/* Onboarding Panel */}
          <section className="form-panel glass">
            <h2 className="panel-title">👤 프로필 정보 및 온보딩 조건 맞추기</h2>
            <p className="panel-subtitle">유저의 현재 상황에 맞는 조건을 입력하고 저장해 주세요. 저장 시 자동으로 맞춤 매칭 분석이 시작됩니다.</p>
            
            <form onSubmit={handleSaveProfile} className="onboarding-form">
              
              {/* 0. 생년월일 (만 나이 계산용) */}
              <div className="form-group">
                <label>📅 생년월일</label>
                <input 
                  type="date" 
                  value={birthDate} 
                  onChange={(e) => setBirthDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--input-border)',
                    color: 'var(--text-primary)',
                    borderRadius: '10px',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  required
                />
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                  ※ 입력값 기준 현재 <strong>만 {calculateManAge(birthDate)}세</strong>로 자동 계산되어 맞춤 매칭됩니다.
                </span>
              </div>

              {/* 1. 지역 */}
              <div className="form-group">
                <label>📍 거주 지역 (시도 및 시군구 선택)</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select 
                    value={selectedSido} 
                    onChange={(e) => {
                      const newSido = e.target.value;
                      setSelectedSido(newSido);
                      const defaultSigungu = KOREA_REGIONS[newSido][0] || "전체";
                      setSelectedSigungu(defaultSigungu);
                      setRegion(`${newSido} ${defaultSigungu}`);
                    }}
                    style={{ flex: 1 }}
                  >
                    {Object.keys(KOREA_REGIONS).map((sido) => (
                      <option key={sido} value={sido}>{sido}</option>
                    ))}
                  </select>
                  
                  <select 
                    value={selectedSigungu} 
                    onChange={(e) => {
                      const newSigungu = e.target.value;
                      setSelectedSigungu(newSigungu);
                      setRegion(`${selectedSido} ${newSigungu}`);
                    }}
                    style={{ flex: 1 }}
                  >
                    {KOREA_REGIONS[selectedSido]?.map((sigungu) => (
                      <option key={sigungu} value={sigungu}>{sigungu}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 2. 학적 */}
              <div className="form-group">
                <label>🎓 학적 상태</label>
                <select value={education} onChange={(e) => setEducation(e.target.value)}>
                  <option value="제한 없음">제한 없음 (누구나)</option>
                  <option value="고등학교 재학">고등학교 재학</option>
                  <option value="고등학교 졸업">고등학교 졸업</option>
                  <option value="대학 신입생/재학생">대학 신입생/재학생</option>
                  <option value="대학 휴학생">대학 휴학생</option>
                  <option value="대학 졸업예정자">대학 졸업예정자</option>
                  <option value="대학 졸업자(미취업)">대학 졸업자(미취업)</option>
                  <option value="대학원 재학/졸업">대학원 재학/졸업</option>
                  <option value="야간대학생">야간대학생</option>
                </select>
              </div>

              {/* 3. 취업 */}
              <div className="form-group">
                <label>💼 근로 및 취업 상태</label>
                <select value={job} onChange={(e) => setJob(e.target.value)}>
                  <option value="미취업">미취업 (구직 중)</option>
                  <option value="재직자">재직자 (직장인)</option>
                  <option value="아르바이트">아르바이트생</option>
                  <option value="소상공인">소상공인 (창업자)</option>
                  <option value="프리랜서">프리랜서</option>
                  <option value="군 복무자">군 복무자 (현역/공익)</option>
                </select>
              </div>

              {/* 4. 주거 */}
              <div className="form-group">
                <label>🏠 주거 상태</label>
                <select value={housing} onChange={(e) => setHousing(e.target.value)}>
                  <option value="무주택">무주택 (가장 추천)</option>
                  <option value="자가">자가 주택</option>
                  <option value="임대주택 입주">공공 임대주택 입주자</option>
                </select>
              </div>

              {/* 5. 주거 상세 */}
              <div className="form-group">
                <label>🔑 주거 점유 상세</label>
                <select value={housingDetail} onChange={(e) => setHousingDetail(e.target.value)}>
                  <option value="월세">월세 거주</option>
                  <option value="전세">전세 거주</option>
                  <option value="부모님 가구 동거">부모님 가구 동거</option>
                  <option value="기숙사">기숙사 / 고시원</option>
                </select>
              </div>

              {/* 6. 소득 수준 */}
              <div className="form-group">
                <label style={{ fontSize: '14.5px', fontWeight: '600', color: 'var(--text-primary)', display: 'block', marginBottom: '2px' }}>
                  💰 본인 또는 가구의 소득 수준을 알려주세요 (필수)
                </label>
                <span style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '10px' }}>
                  ※ 기준은 중위소득 구간(%)을 활용합니다.
                </span>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                  {[
                    "0 ~ 50%",
                    "51 ~ 75%",
                    "76 ~ 100%",
                    "101 ~ 200%",
                    "200% 초과"
                  ].map((val) => (
                    <label key={val} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px', 
                      padding: '10px 14px', 
                      borderRadius: '8px', 
                      background: income === val ? 'rgba(99, 102, 241, 0.12)' : 'var(--input-bg)', 
                      border: income === val ? '1px solid #6366f1' : '1px solid var(--input-border)',
                      cursor: 'pointer', 
                      transition: 'all 0.2s ease',
                      fontSize: '13.5px',
                      color: 'var(--text-primary)',
                      fontWeight: income === val ? '600' : '400'
                    }}>
                      <input 
                        type="radio" 
                        name="income" 
                        value={val} 
                        checked={income === val} 
                        onChange={(e) => setIncome(e.target.value)}
                        style={{ 
                          margin: 0, 
                          accentColor: '#6366f1',
                          width: '17px',
                          height: '17px',
                          cursor: 'pointer'
                        }}
                      />
                      <span>{val}</span>
                    </label>
                  ))}
                </div>

                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center' }}>
                  <button 
                    type="button"
                    onClick={() => setShowIncomeModal(true)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: '#818cf8', 
                      fontSize: '12px', 
                      cursor: 'pointer', 
                      padding: 0, 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px',
                      fontWeight: '500',
                      textDecoration: 'underline'
                    }}
                  >
                    ℹ️ 2026년 가구 규모별 기준중위 소득표 자세히 보기 &gt;
                  </button>
                </div>
              </div>

              {/* 7. 관심 분야 */}
              <div className="form-group">
                <label>🌟 주요 관심 카테고리</label>
                <select value={interest} onChange={(e) => setInterest(e.target.value)}>
                  <option value="주거">주거 (임차료/대출 이자/임대주택)</option>
                  <option value="일자리">일자리 및 창업</option>
                  <option value="교육">교육 및 인재 양성</option>
                  <option value="복지/문화">복지 및 문화 예술</option>
                  <option value="참여/권리">참여 및 정책 권리</option>
                </select>
              </div>

              {/* 8. 특수사항 (다중선택) */}
              <div className="form-group">
                <label style={{ fontSize: '15px', fontWeight: '600', color: '#a5b4fc', marginBottom: '8px', display: 'block' }}>
                  🎗️ 세부 특수 상황 & 우대 조건 (무제한 중복 선택 가능)
                </label>
                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '-4px', marginBottom: '16px', lineHeight: '1.4' }}>
                  💡 <strong>정부24 혜택알리미의 한계(분야별 최대 2개만 선택 가능)를 극복</strong>하여, 아래의 모든 조건들을 제한 없이 무제한으로 중복 체크할 수 있습니다.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {SPECIAL_GROUPS.map((group) => (
                    <div key={group.title} style={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.02)', 
                      borderRadius: '8px', 
                      padding: '14px',
                      border: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                      <span style={{ 
                        fontSize: '13px', 
                        fontWeight: '600', 
                        color: '#c7d2fe', 
                        marginBottom: '10px', 
                        display: 'block'
                      }}>{group.title}</span>
                      <div className="checkbox-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: '8px'
                      }}>
                        {group.items.map((item) => (
                          <label key={item} className={`checkbox-label ${special.includes(item) ? 'checked' : ''}`} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            backgroundColor: special.includes(item) ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid ' + (special.includes(item) ? '#818cf8' : 'rgba(255, 255, 255, 0.06)'),
                            cursor: 'pointer',
                            fontSize: '12px',
                            color: special.includes(item) ? '#fff' : '#94a3b8',
                            transition: 'all 0.15s ease',
                            userSelect: 'none'
                          }}>
                            <input
                              type="checkbox"
                              checked={special.includes(item)}
                              onChange={() => handleSpecialChange(item)}
                              style={{ display: 'none' }}
                            />
                            <span>{item}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 9. 나의 보유 서류 (온보딩 통합) */}
              <div className="form-group" style={{ marginTop: '24px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>📁 나의 보유 서류</label>
                  <button 
                    type="button"
                    onClick={() => setIsEditingDocs(!isEditingDocs)}
                    style={{
                      background: isEditingDocs ? '#ef4444' : 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.2s'
                    }}
                  >
                    {isEditingDocs ? '✅ 완료' : '✏️ 편집'}
                  </button>
                </div>
                <span style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '12px' }}>
                  ※ 현재 본인이 보유 중이거나 즉시 발급 가능한 서류를 선택해 주세요. 공고문 매칭 시 실시간 서류 대조 분석에 활용됩니다.
                </span>

                {/* 직접 추가하는 플러스 인풋 영역 */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <input 
                    type="text" 
                    placeholder="추가할 서류 명칭 입력 (예: 경력증명서)"
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDocument();
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      color: 'var(--text-primary)',
                      borderRadius: '8px',
                      fontSize: '13.5px',
                      outline: 'none'
                    }}
                  />
                  <button 
                    type="button" 
                    onClick={handleAddDocument}
                    style={{
                      padding: '0 16px',
                      background: '#6366f1',
                      border: 'none',
                      color: '#fff',
                      borderRadius: '8px',
                      fontSize: '13.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#4f46e5'}
                    onMouseLeave={e => e.currentTarget.style.background = '#6366f1'}
                  >
                    + 추가
                  </button>
                </div>

                <div className="doc-vault-grid">
                  {documentCandidates.map((doc) => (
                    <div key={doc} style={{ position: 'relative', display: 'inline-block' }}>
                      <label className={`doc-vault-item ${ownedDocuments.includes(doc) ? 'active' : ''}`} style={{ width: '100%', boxSizing: 'border-box' }}>
                        <input 
                          type="checkbox" 
                          checked={ownedDocuments.includes(doc)} 
                          disabled={isEditingDocs}
                          onChange={() => handleDocumentToggle(doc)}
                        />
                        <span className="check-box-symbol"></span>
                        <span className="doc-name">{doc}</span>
                      </label>
                      {isEditingDocs && (
                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(doc)}
                          style={{
                            position: 'absolute',
                            top: '-5px',
                            right: '-5px',
                            background: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '50%',
                            width: '18px',
                            height: '18px',
                            fontSize: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            zIndex: 10
                          }}
                        >
                          ❌
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? (
                  <span className="spinner-loader"></span>
                ) : (
                  '🎯 프로필 저장 및 맞춤 매칭받기'
                )}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* ❌ '안함/못함' 피드백 입력 모달 */}
      {showDeclineModal && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <h3>❌ 정책 거절 피드백 수집</h3>
            <p>
              해당 정책 지원을 보류하거나 포기하시는 주된 원인을 선택해 주세요.<br/>
              전달해 주신 피드백은 시스템 맞춤도 향상 및 청년 정책 개선 통계로 활용됩니다.
            </p>
            
            <div className="decline-options">
              {[
                '지원 대상에 해당되지 않음 (나이, 소득 등 요건 불충족)',
                '지원 혜택이 매력적이지 않음 (지원금 규모가 적음 - 혜택 부족)',
                '신청 절차 및 구비 서류 발급이 너무 복잡함',
                '이미 신청 기한이 경과하여 지원 불가능',
                '이미 유사한 다른 청년 혜택을 받고 있음',
                '기타 사유'
              ].map((reason) => (
                <label key={reason} className="decline-option-item">
                  <input
                    type="radio"
                    name="declineReason"
                    value={reason}
                    checked={declineReason === reason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                  />
                  <span className="radio-circle"></span>
                  <span className="radio-text">{reason}</span>
                </label>
              ))}
            </div>

            <div className="modal-footer">
              <button className="modal-btn submit" onClick={submitDeclineFeedback}>제출 및 제외</button>
              <button className="modal-btn cancel" onClick={() => setShowDeclineModal(false)}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 💰 기준중위 소득표 상세 보기 모달 */}
      {showIncomeModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content glass" style={{ 
            maxWidth: '900px', 
            width: '95%', 
            maxHeight: '90vh', 
            overflowY: 'auto',
            padding: '24px',
            borderRadius: '16px',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', color: 'var(--text-primary)', fontWeight: '700' }}>📊 2026년 가구 규모별 기준중위 소득표</h3>
              <button 
                onClick={() => setShowIncomeModal(false)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--text-secondary)', 
                  fontSize: '24px', 
                  cursor: 'pointer', 
                  padding: '0 8px' 
                }}
              >
                &times;
              </button>
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
              gap: '16px', 
              marginBottom: '20px'
            }}>
              {[
                {
                  range: "0 ~ 50%",
                  data: { "1인가구": "1,282,119원", "2인가구": "2,099,646원", "3인가구": "2,679,518원", "4인가구": "3,247,369원", "5인가구": "3,778,360원", "6인가구": "4,277,976원" }
                },
                {
                  range: "51 ~ 75%",
                  data: { "1인가구": "1,923,178원", "2인가구": "3,149,469원", "3인가구": "4,019,277원", "4인가구": "4,871,054원", "5인가구": "5,667,539원", "6인가구": "6,416,964원" }
                },
                {
                  range: "76 ~ 100%",
                  data: { "1인가구": "2,564,238원", "2인가구": "4,199,292원", "3인가구": "5,359,036원", "4인가구": "6,494,738원", "5인가구": "7,556,719원", "6인가구": "8,555,952원" }
                },
                {
                  range: "101 ~ 200%",
                  data: { "1인가구": "5,128,476원", "2인가구": "8,398,584원", "3인가구": "10,718,072원", "4인가구": "12,989,476원", "5인가구": "15,113,438원", "6인가구": "17,111,904원" }
                },
                {
                  range: "200% 초과",
                  data: { "1인가구": "5,128,476원", "2인가구": "8,398,584원", "3인가구": "10,718,072원", "4인가구": "12,989,476원", "5인가구": "15,113,438원", "6인가구": "17,111,904원" }
                }
              ].map((item) => (
                <div key={item.range} style={{ 
                  background: 'rgba(255,255,255,0.03)', 
                  border: '1px solid rgba(255,255,255,0.08)', 
                  borderRadius: '12px', 
                  padding: '16px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14.5px', color: '#818cf8', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                    {item.range}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.entries(item.data).map(([family, amount]) => (
                      <div key={family} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{family}</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: '550' }}>{amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="modal-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="modal-btn submit" 
                style={{ 
                  padding: '8px 24px', 
                  borderRadius: '8px', 
                  fontSize: '13px', 
                  fontWeight: '600',
                  background: '#6366f1',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer'
                }} 
                onClick={() => setShowIncomeModal(false)}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 💬 카카오톡 알림톡 시뮬레이션 Toast */}
      <div className="kakao-toast-container">
        {kakaoToasts.map((toast) => (
          <div key={toast.id} className="kakao-toast fade-in">
            <div className="kakao-header">
              <div className="kakao-profile-icon">💬</div>
              <div className="kakao-sender">Gov24+ 알리미 (알림톡)</div>
              <button className="kakao-close-btn" onClick={() => setKakaoToasts(prev => prev.filter(t => t.id !== toast.id))}>×</button>
            </div>
            <div className="kakao-body">
              <strong>[마감 임박 알림] {toast.title}</strong>
              <p>{toast.text}</p>
              <div className="kakao-footer">
                <span className="kakao-btn" onClick={() => window.open("https://plus.gov.kr", "_blank")}>자세히 보기</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <footer className="app-footer">
        <p>© 2026 Gov24 Plus - RAG & MySQL Hybrid 청년 정책 스마트 추천 시스템 (캡스톤 디자인 3차 완성본)</p>
      </footer>

      {/* 🤖 AI 환각방지 챗봇 플로팅 위젯 */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        fontFamily: "'Inter', 'Outfit', sans-serif"
      }}>
        {/* 챗봇 대화창 */}
        {showChatbot && (
          <div style={{
            width: '380px',
            height: '520px',
            background: 'rgba(15, 23, 42, 0.93)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            marginBottom: '16px',
            transition: 'all 0.3s ease'
          }}>
            {/* 헤더 */}
            <div style={{
              padding: '16px 20px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.25rem' }}>🤖</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px' }}>Gov24+ AI 챗봇 비서</div>
                  <div style={{ fontSize: '10px', color: '#c7d2fe', fontWeight: '500' }}>RAG 기반 개인화 및 환각방지 적용</div>
                </div>
              </div>
              <button 
                onClick={() => setShowChatbot(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                ×
              </button>
            </div>

            {/* 메시지 영역 */}
            <div style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: 'rgba(0, 0, 0, 0.15)'
            }}>
              {chatMessages.map((msg, mIdx) => (
                <div 
                  key={mIdx} 
                  style={{
                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div style={{
                    background: msg.sender === 'user' ? '#6366f1' : 'rgba(255, 255, 255, 0.05)',
                    color: msg.sender === 'user' ? '#fff' : '#e2e8f0',
                    padding: '10px 14px',
                    borderRadius: msg.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    textAlign: 'left',
                    wordBreak: 'break-word',
                    border: msg.sender === 'user' ? 'none' : '1px solid rgba(255,255,255,0.04)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    {msg.sender === 'bot' ? (
                      msg.text.split('\n').map((line, lIdx) => (
                        <div key={lIdx} style={{ minHeight: '1.2em' }}>{parseBoldMarkdown(line)}</div>
                      ))
                    ) : (
                      msg.text
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '10px 18px',
                    borderRadius: '12px 12px 12px 2px',
                    color: '#94a3b8',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span className="spinner-loader" style={{ width: '12px', height: '12px', borderWidth: '2px' }}></span>
                    AI 비서가 답변을 작성 중입니다...
                  </div>
                </div>
              )}
            </div>

            {/* 입력 폼 */}
            <form 
              onSubmit={handleSendChatMessage}
              style={{
                padding: '12px 16px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                gap: '8px',
                background: 'rgba(15, 23, 42, 0.95)'
              }}
            >
              <input 
                type="text" 
                placeholder="예: 알바 소득도 소득 구간에 잡히나요?"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={chatLoading}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
              <button 
                type="submit"
                disabled={chatLoading}
                style={{
                  background: '#6366f1',
                  border: 'none',
                  color: '#fff',
                  padding: '0 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#4f46e5'}
                onMouseLeave={e => e.currentTarget.style.background = '#6366f1'}
              >
                전송
              </button>
            </form>
          </div>
        )}

        {/* 💬 플로팅 아이콘 버튼 */}
        <button
          onClick={() => setShowChatbot(!showChatbot)}
          style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            border: 'none',
            borderRadius: '50%',
            width: '56px',
            height: '56px',
            boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.4), 0 4px 6px -2px rgba(99, 102, 241, 0.2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            color: '#fff',
            transition: 'transform 0.2s',
            outline: 'none'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {showChatbot ? '×' : '💬'}
        </button>
      </div>

      {/* 🤖 드래그 툴팁 팝업 버튼 */}
      {showDragTooltip && (
        <button
          className="chatbot-drag-tooltip-btn"
          onClick={handleAskDragText}
          style={{
            position: 'absolute',
            left: `${tooltipCoords.x}px`,
            top: `${tooltipCoords.y}px`,
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '20px',
            padding: '8px 14px',
            fontSize: '12.5px',
            fontWeight: 'bold',
            boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.4), 0 4px 6px -2px rgba(99, 102, 241, 0.2)',
            cursor: 'pointer',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          <span>🤖</span> AI 챗봇에게 물어보기
        </button>
      )}

      {/* 🔮 글로벌 화면 잠금/어둡게 처리형 RAG 로딩 오버레이 */}
      {loading && (
        <div className="global-loading-overlay">
          <div className="global-loading-card glass">
            {/* 상단 기하학 발광 광원 */}
            <div className="loading-glow-orb"></div>
            
            {/* 회전 로더 링 */}
            <div className="loading-ring-container">
              <div className="loading-ring"></div>
              <span className="loading-ring-icon">🤖</span>
            </div>

            <h3>실시간 RAG 검증 및 AI 분석 진행 중</h3>
            
            {/* 📊 게이지바 */}
            <div className="loading-progress-bar-wrapper">
              <div 
                className="loading-progress-bar-fill" 
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>

            {/* 🔢 백분율 */}
            <div className="loading-percentage-text">
              {loadingProgress}%
            </div>
            
            {/* 📝 상태 설명글 */}
            <p className="loading-step-description">
              {loadingStepText || '분석 정보를 준비하고 있습니다...'}
            </p>
            
            {/* 안내 팁 */}
            <div className="loading-tip-badge">
              💡 게이지가 5분 이상 멈춰있을 경우 새로고침(F5) 해주세요
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;