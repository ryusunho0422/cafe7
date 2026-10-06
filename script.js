/* ===================================================
   숭실 카페 주문서 스크립트
   파일: script.js

   이 파일이 하는 일:
   1. 주문 항목 변경 시 예상 금액 실시간 계산
   2. 탭 전환 (주문하기 ↔ 주문 내역)
   3. 주문 접수 → orders 배열에 저장 + 확인 메시지 표시
   4. 주문 내역 목록 렌더링 (renderOrders)
   5. 주문 취소 / 전체 삭제
   6. 다시 작성 시 주문서만 초기화 (내역 유지)
   =================================================== */


/* ===================================================
   [Supabase 설정]
   - 아래 두 상수에 Supabase Project URL과 anon KEY를 넣어주세요.
   =================================================== */
const SUPABASE_URL = 'https://uffqwciwvxvhrrjqouha.supabase.co'; // 여기에 Supabase Project URL 입력 (예: https://xyz.supabase.co)
const SUPABASE_KEY = 'sb_publishable_qFBDze_oxf3YEWI8HEpZBg_tKXqy_dd'; // 여기에 Supabase anon public API 키 입력

// Supabase 클라이언트 객체 생성 (변수 이름: supabaseClient)
// window.supabase 라이브러리가 index.html의 CDN으로 로드된 후 생성됩니다.
const supabaseClient = (window.supabase && SUPABASE_URL && SUPABASE_KEY)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : (window.supabase ? window.supabase.createClient(SUPABASE_URL || 'https://placeholder.supabase.co', SUPABASE_KEY || 'placeholder') : null);


/* ─────────────────────────────────────────────────
   [1단계] HTML 요소 가져오기
   document.getElementById / querySelector로 연결
───────────────────────────────────────────────── */

/* 주문서 폼 관련 */
const form           = document.getElementById('order-form');
const nameInput      = document.getElementById('customer-name');
const phoneInput     = document.getElementById('phone');         // 전화번호 입력칸
const drinkSelect    = document.getElementById('drink');
const quantityInput  = document.getElementById('quantity');
const requestInput   = document.getElementById('request');
const totalPriceEl   = document.getElementById('total-price');
const confirmationEl = document.getElementById('order-confirmation');
const submitBtn      = document.getElementById('submit-btn');    // 주문하기 버튼
const resetBtn       = document.getElementById('reset-btn');

/* 로고 요소 (기본 커피 그림 vs 주문 완료 시 캐릭터 그림) */
const logoCoffee    = document.getElementById('logo-coffee');
const logoCharacter = document.getElementById('logo-character');

/* 탭 관련 */
const tabBtns    = document.querySelectorAll('.tab-btn'); // 모든 탭 버튼
const tabOrder   = document.getElementById('tab-order');   // 주문하기 탭 패널
const tabHistory = document.getElementById('tab-history'); // 주문 내역 탭 패널
const orderBadge = document.getElementById('order-badge'); // 건수 배지

/* 주문 내역 탭 안의 요소들 */
const ordersList   = document.getElementById('orders-list');   // 카드 목록 컨테이너
const ordersFooter = document.getElementById('orders-footer'); // 총액 + 삭제 버튼 영역
const ordersSummaryEl = document.getElementById('orders-summary'); // 총액 텍스트
const clearAllBtn  = document.getElementById('clear-all-btn'); // 전체 삭제 버튼


/* ─────────────────────────────────────────────────
   [2단계] 주문 데이터 저장소
   orders: 접수된 주문 객체를 담는 배열
   orderCounter: 주문 번호 (접수마다 1씩 증가)
───────────────────────────────────────────────── */
let orders = [];
let orderCounter = 1;


/* ─────────────────────────────────────────────────
   [3단계] 핵심 함수: calculateTotal()
   (음료 가격 + 사이즈 추가 + 옵션 합계) × 수량
   화면에 표시하고, 숫자 값도 반환
───────────────────────────────────────────────── */
function calculateTotal() {

  /* 음료 가격: 선택된 <option>의 data-price 읽기 */
  const selectedOption = drinkSelect.options[drinkSelect.selectedIndex];
  const drinkPrice = parseInt(selectedOption.dataset.price, 10) || 0;

  /* 사이즈 추가 금액: checked 상태인 라디오의 data-price */
  const checkedSize = document.querySelector('input[name="size"]:checked');
  const sizePrice = checkedSize ? (parseInt(checkedSize.dataset.price, 10) || 0) : 0;

  /* 추가 옵션: checked 상태인 체크박스의 data-price 모두 합산 */
  let extrasPrice = 0;
  document.querySelectorAll('input[name="extras"]:checked').forEach(function (cb) {
    extrasPrice += parseInt(cb.dataset.price, 10) || 0;
  });

  /* 수량: 범위 보정 (1~10) */
  let quantity = parseInt(quantityInput.value, 10) || 1;
  if (quantity < 1)  quantity = 1;
  if (quantity > 10) quantity = 10;

  /* 최종 금액 계산 및 화면 표시 */
  const total = (drinkPrice + sizePrice + extrasPrice) * quantity;
  totalPriceEl.textContent = total.toLocaleString(); // 천 단위 콤마

  return total; // 주문 접수 시 재사용
}


/* ─────────────────────────────────────────────────
   [4단계] 실시간 금액 업데이트 이벤트 등록
   음료 / 사이즈 / 추가옵션 / 수량 변경 시마다 계산
───────────────────────────────────────────────── */
drinkSelect.addEventListener('change', calculateTotal);
quantityInput.addEventListener('input', calculateTotal);

/* 사이즈 라디오 버튼 전체에 이벤트 등록 */
document.querySelectorAll('input[name="size"]').forEach(function (radio) {
  radio.addEventListener('change', calculateTotal);
});

/* 추가 옵션 체크박스 전체에 이벤트 등록 */
document.querySelectorAll('input[name="extras"]').forEach(function (checkbox) {
  checkbox.addEventListener('change', calculateTotal);
});


/* ─────────────────────────────────────────────────
   [5단계] 탭 전환 기능
   클릭한 탭 버튼을 활성화하고 해당 패널만 보여줌
───────────────────────────────────────────────── */
tabBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    /* 모든 탭 버튼 비활성화 */
    tabBtns.forEach(function (b) {
      b.classList.remove('tab-active');
      b.setAttribute('aria-selected', 'false');
    });

    /* 클릭한 버튼 활성화 */
    btn.classList.add('tab-active');
    btn.setAttribute('aria-selected', 'true');

    /* 탭 패널 전환 */
    if (btn.dataset.tab === 'order') {
      tabOrder.classList.remove('hidden');
      tabHistory.classList.add('hidden');
    } else {
      tabOrder.classList.add('hidden');
      tabHistory.classList.remove('hidden');
      renderOrders(); // 주문 내역 탭으로 전환할 때 목록 새로 그리기
    }
  });
});


/* ─────────────────────────────────────────────────
   [6단계] renderOrders()
   orders 배열 전체를 읽어 화면에 카드 목록을 그림.
   주문 추가 / 취소 / 삭제 / 탭 전환 시 호출.
───────────────────────────────────────────────── */
function renderOrders() {

  /* 기존 목록 비우기: innerHTML 대신 반복 제거 (보안) */
  while (ordersList.firstChild) {
    ordersList.removeChild(ordersList.firstChild);
  }

  /* 주문이 없을 때: 안내 문구 표시 + 하단 영역 숨김 */
  if (orders.length === 0) {
    const emptyEl = document.createElement('p');
    emptyEl.className = 'empty-message';
    emptyEl.textContent = '아직 주문 내역이 없어요 ☕';
    ordersList.appendChild(emptyEl);

    ordersFooter.classList.add('hidden');
    orderBadge.classList.add('hidden');
    return;
  }

  /* 배지 업데이트 */
  orderBadge.textContent = orders.length;
  orderBadge.classList.remove('hidden');

  /* 최신 주문이 맨 위에 오도록 배열을 역순 복사 후 카드 생성
     (원본 orders 배열은 건드리지 않음) */
  [...orders].reverse().forEach(function (order) {
    const card = createOrderCard(order);
    ordersList.appendChild(card);
  });

  /* 총 주문 금액 계산 및 표시 */
  const totalAmount = orders.reduce(function (sum, o) {
    return sum + o.total;
  }, 0);
  ordersSummaryEl.textContent =
    '총 주문 금액: ' + totalAmount.toLocaleString() + '원 (' + orders.length + '건)';
  ordersFooter.classList.remove('hidden');
}


/* ─────────────────────────────────────────────────
   [7단계] createOrderCard(order)
   주문 객체 하나를 받아 카드 DOM 요소를 반환.
   손님 입력값은 모두 textContent로 삽입 (XSS 방어)
───────────────────────────────────────────────── */
function createOrderCard(order) {

  /* 카드 최상위 div */
  const card = document.createElement('div');
  card.className = 'order-card';

  /* ── 카드 헤더 ── */
  const header = document.createElement('div');
  header.className = 'order-card-header';

  /* 헤더 왼쪽: "#1 홍길동님 · 5,000원" */
  const titleEl = document.createElement('span');
  titleEl.className = 'order-card-title';
  // 이름은 손님이 입력한 값 → textContent로 삽입
  titleEl.textContent = '#' + order.id + ' ' + order.name + '님 · ' + order.total.toLocaleString() + '원';

  /* 헤더 오른쪽: 취소 버튼 */
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'order-cancel-btn';
  cancelBtn.textContent = '취소';

  /* 취소 버튼 클릭: confirm으로 한 번 더 확인 후 삭제 */
  cancelBtn.addEventListener('click', function () {
    // confirm() 창에 표시되는 이름도 textContent이므로 XSS 위험 없음
    if (confirm(order.name + '님의 주문을 취소할까요?')) {
      // id가 일치하지 않는 주문만 남겨서 해당 주문 제거
      orders = orders.filter(function (o) {
        return o.id !== order.id;
      });
      renderOrders(); // 목록 다시 그리기
    }
  });

  header.appendChild(titleEl);
  header.appendChild(cancelBtn);

  /* ── 카드 본문 ── */
  const body = document.createElement('div');
  body.className = 'order-card-body';

  /* 음료 정보 줄: "카페라떼 M사이즈 (샷 추가) 1잔" */
  const extrasText = order.extras.length > 0
    ? ' (' + order.extras.join(', ') + ')'
    : ''; // 옵션 없으면 괄호 생략

  const drinkLine = document.createElement('p');
  drinkLine.className = 'order-drink';
  drinkLine.textContent =
    order.drink + ' ' + order.size + '사이즈' + extrasText + ' ' + order.quantity + '잔';
  body.appendChild(drinkLine);

  /* 요청사항 줄: 내용이 있을 때만 표시 */
  if (order.request && order.request.trim() !== '') {
    const reqLine = document.createElement('p');
    reqLine.className = 'order-request';
    reqLine.textContent = '📝 ' + order.request; // 손님 입력 → textContent
    body.appendChild(reqLine);
  }

  /* 주문 시간 줄 */
  const timeLine = document.createElement('p');
  timeLine.className = 'order-time';
  timeLine.textContent = '⏰ ' + order.time;
  body.appendChild(timeLine);

  card.appendChild(header);
  card.appendChild(body);

  return card;
}


/* ─────────────────────────────────────────────────
   [8단계] 주문하기 버튼 클릭 처리
   유효성 검사 → Supabase(cafe7 테이블) 저장 → 
   성공 시 메시지 표시 및 화면 갱신 / 실패 시 알림
───────────────────────────────────────────────── */
form.addEventListener('submit', async function (event) {
  event.preventDefault(); // 페이지 새로고침 방지

  /* 유효성 검사 1: 이름 확인 */
  const nameValue = nameInput.value.trim();
  if (nameValue === '') {
    alert('이름을 입력해주세요.');
    nameInput.focus();
    return;
  }

  /* 유효성 검사 2: 음료 선택 확인 */
  const drinkValue = drinkSelect.value;
  if (drinkValue === '') {
    alert('음료를 선택해주세요.');
    drinkSelect.focus();
    return;
  }

  /* ── 주문 정보 수집 ── */

  // 1. 전화번호
  const phoneValue = phoneInput ? phoneInput.value.trim() : '';

  // 2. 음료 이름 (option 텍스트에서 가격 글자 제거: "카페라떼 4,000원" → "카페라떼")
  const selectedOption = drinkSelect.options[drinkSelect.selectedIndex];
  const drinkText = selectedOption.text
    .replace(/\s*[\d,]+원$/, '')
    .trim();

  // 3. 음료 기본 가격 (data-price 속성 값 읽기)
  const drinkPrice = parseInt(selectedOption.dataset.price, 10) || 0;

  // 4. 사이즈 값 ("S" / "M" / "L")
  const sizeValue = document.querySelector('input[name="size"]:checked').value;

  // 5. 추가 옵션 배열 (options)
  const extraNames = [];
  document.querySelectorAll('input[name="extras"]:checked').forEach(function (cb) {
    const label = document.querySelector('label[for="' + cb.id + '"]');
    if (label) {
      const text = label.textContent
        .replace(/\s*\+[\d,]+원$/, '')
        .trim();
      extraNames.push(text);
    }
  });

  // 6. 수량
  const quantity = parseInt(quantityInput.value, 10) || 1;

  // 7. 요청사항
  const requestValue = requestInput.value.trim();

  // 8. 최종 총 금액
  const total = calculateTotal();

  // 9. 현재 시간 문자열 ("YYYY-MM-DD HH:MM")
  const now = new Date();
  const timeStr =
    now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + ' ' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0');

  /* ── Supabase 전송용 데이터 객체 (열 이름 일치) ── */
  const orderPayload = {
    customer_name: nameValue,
    phone:         phoneValue,
    drink:         drinkText,
    drink_price:   drinkPrice,
    size:          sizeValue,
    options:       extraNames,  // 추가옵션 배열
    quantity:      quantity,
    request:       requestValue,
    total_price:   total
  };

  /* ── 더블 클릭 방지: 주문하기 버튼 비활성화 ── */
  const originalBtnText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = '주문 저장 중... ⏳';

  try {
    /* ── Supabase cafe_orders 테이블에 데이터 INSERT ── */
    if (!SUPABASE_URL || !SUPABASE_KEY || !supabaseClient) {
      throw new Error('Supabase URL 또는 KEY가 script.js에 설정되지 않았습니다.');
    }

    const { data, error } = await supabaseClient
      .from('cafe_orders')
      .insert([orderPayload])
      .select();

    // 에러 발생 시 catch 블록으로 이동
    if (error) {
      throw error;
    }

    /* ── [저장 성공 시 처리] ── */

    // Supabase가 발급해준 ID가 있으면 사용, 없으면 프론트 카운터 사용
    const newOrderId = (data && data[0] && data[0].id) ? data[0].id : orderCounter++;

    // 1. 로컬 orders 배열에 추가 및 주문 내역 화면 갱신
    const newOrder = {
      id:       newOrderId,
      name:     nameValue,
      drink:    drinkText,
      size:     sizeValue,
      extras:   extraNames,
      quantity: quantity,
      request:  requestValue,
      total:    total,
      time:     timeStr
    };
    orders.push(newOrder);
    renderOrders();

    // 2. 주문 확인 메시지 표시
    const extrasText = extraNames.length > 0
      ? ' (' + extraNames.join(', ') + ')'
      : '';
    const message =
      nameValue + '님, ' +
      drinkText + ' ' + sizeValue + '사이즈' + extrasText + ' ' +
      quantity + '잔, 총 ' + total.toLocaleString() + '원 주문이 접수되었습니다! ☕';

    confirmationEl.textContent = message; // textContent로 안전하게 삽입
    confirmationEl.classList.remove('hidden');

    // 3. 상단 로고: 기본 커피 그림을 숨기고 마린 캐릭터 그림 등장!
    if (logoCoffee && logoCharacter) {
      logoCoffee.classList.add('hidden');
      logoCharacter.classList.remove('hidden');
    }

    // 4. 확인 메시지 영역으로 부드럽게 스크롤
    confirmationEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

  } catch (err) {
    /* ── [저장 실패 시 처리] ── */
    console.error('Supabase 주문 저장 에러:', err);
    const errorMsg = err.message || err.error_description || (typeof err === 'object' ? JSON.stringify(err) : String(err));
    alert('주문 저장에 실패했어요:\n\n[원인] ' + errorMsg);
  } finally {
    /* ── 작업 완료 후 주문하기 버튼 다시 활성화 ── */
    submitBtn.disabled = false;
    submitBtn.textContent = originalBtnText;
  }
});


/* ─────────────────────────────────────────────────
   [9단계] 다시 작성 버튼
   주문서 입력칸만 초기화.
   orders 배열은 건드리지 않아 주문 내역 유지.
───────────────────────────────────────────────── */
resetBtn.addEventListener('click', function () {
  form.reset();                              // HTML 기본값으로 입력칸 초기화
  totalPriceEl.textContent = '0';            // 금액 0원으로 리셋
  confirmationEl.classList.add('hidden');    // 확인 메시지 숨기기
  confirmationEl.textContent = '';           // 내용 비우기

  /* 상단 로고 복구: 마린 캐릭터를 숨기고 원래의 커피 그림 표시 */
  if (logoCoffee && logoCharacter) {
    logoCoffee.classList.remove('hidden');
    logoCharacter.classList.add('hidden');
  }

  // orders 배열은 변경하지 않음 → 주문 내역 보존
});


/* ─────────────────────────────────────────────────
   [10단계] 내역 모두 지우기 버튼
   confirm으로 확인 후 orders 배열 전체 초기화
───────────────────────────────────────────────── */
clearAllBtn.addEventListener('click', function () {
  if (confirm('주문 내역을 모두 지울까요?')) {
    orders = [];        // 배열 비우기
    renderOrders();     // 목록 다시 그리기 (빈 상태)
  }
});


/* ─────────────────────────────────────────────────
   [11단계] 페이지 로드 시 초기화
   초기 금액 0원 표시 + 빈 주문 내역 초기 렌더링
───────────────────────────────────────────────── */
calculateTotal();
renderOrders();
