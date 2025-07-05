// --- 1. Google Sheets API 설정 및 데이터 불러오기 ---
// !!! 여기에 발급받은 API 키를 입력하세요 !!!
const API_KEY = 'AIzaSyDA0sqk1w-v-TOoiTSVpeN-nDu-4tWqJGg';
// !!! 여기에 구글 스프레드시트 ID를 입력하세요 (URL에서 docs.google.com/spreadsheets/d/여기/edit) !!!
const SPREADSHEET_ID = '15Vkcebz289pU-sKzDGm9ETFfvbZiuG1VYTLcHST-CLw';

// 각 시트의 이름을 배열로 정의 (구글 시트 탭 이름과 정확히 일치)
const SHEET_NAMES = ['K-POP', 'POP', 'J-POP'];

// 불러온 데이터를 저장할 전역 변수
let categorizedSongs = {}; // 카테고리별로 분류된 노래 목록
let allSongsById = {};    // 번호로 찾기 기능을 위한 전체 노래 목록 (ID 할당 후)

// Google API 클라이언트 라이브러리 초기화
function handleClientLoad() {
    gapi.load('client', initClient);
}

async function initClient() {
    try {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
        });
        // 초기 데이터 로드 및 새로고침 버튼 활성화
        refreshSongList(true); // true는 초기 로드임을 나타냄
    } catch (error) {
        console.error("Google API 클라이언트 초기화 실패:", error);
        alert("API 초기화에 실패했습니다. API 키와 스프레드시트 ID를 확인해주세요.");
        refreshButton.disabled = true; // 버튼 비활성화
    }
}

// 구글 스프레드시트에서 모든 시트의 데이터를 불러오는 함수
async function loadSongsFromGoogleSheet() {
    const fetchedData = {};
    for (const sheetName of SHEET_NAMES) {
        try {
            // A열부터 C열까지 (artist, title, youtubeId 순서라고 가정)
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${sheetName}!A:C`,
            });

            const values = response.result.values;
            if (values && values.length > 1) {
                const headers = values[0].map(h => h.toLowerCase()); // 헤더를 소문자로 변환
                const songs = values.slice(1).map(row => {
                    let song = {};
                    headers.forEach((header, index) => {
                        song[header] = row[index]; // 헤더 이름에 따라 데이터 매핑
                    });
                    // youtubeId가 없는 경우 빈 문자열로 처리
                    if (!song.youtubeid) song.youtubeid = '';
                    return song;
                });
                fetchedData[sheetName] = songs;
            } else {
                fetchedData[sheetName] = []; // 데이터가 없으면 빈 배열
                console.warn(`시트 '${sheetName}'에 데이터가 없습니다.`);
            }
        } catch (error) {
            console.error(`시트 '${sheetName}'에서 데이터를 불러오는 데 실패했습니다:`, error);
            fetchedData[sheetName] = [];
        }
    }
    return fetchedData;
}

// --- 2. 새로고침 버튼 및 쿨다운 로직 ---
const refreshButton = document.getElementById('refreshButton');
const cooldownTimerSpan = document.getElementById('cooldownTimer');
const COOLDOWN_SECONDS = 60; // 쿨다운 시간 (1분 = 60초)
let cooldownInterval; // setInterval을 저장할 변수

async function refreshSongList(isInitialLoad = false) {
    if (!isInitialLoad) { // 초기 로드가 아닐 때만 쿨다운 적용
        refreshButton.disabled = true; // 버튼 비활성화
        let remainingTime = COOLDOWN_SECONDS;
        cooldownTimerSpan.textContent = `(${remainingTime}초 후 재사용 가능)`;

        cooldownInterval = setInterval(() => {
            remainingTime--;
            if (remainingTime <= 0) {
                clearInterval(cooldownInterval);
                refreshButton.disabled = false;
                cooldownTimerSpan.textContent = '';
            } else {
                cooldownTimerSpan.textContent = `(${remainingTime}초 후 재사용 가능)`;
            }
        }, 1000);
    }

    try {
        const data = await loadSongsFromGoogleSheet();
        categorizedSongs = data; // 전역 변수에 저장

        // 각 카테고리 탭에 노래 목록 표시
        displayCategorizedSongs('K-POP', categorizedSongs['K-POP'] || []);
        displayCategorizedSongs('POP', categorizedSongs['POP'] || []);
        displayCategorizedSongs('J-POP', categorizedSongs['J-POP'] || []);

        // 번호 찾기 기능을 위한 전체 노래 목록 준비 및 번호 할당
        shuffleSongNumbers(); // 초기 로드 시에도 번호 섞기

    } catch (error) {
        console.error("노래 목록을 불러오는 중 오류 발생:", error);
        alert("노래 목록을 불러오는 데 실패했습니다. API 키, 스프레드시트 ID, 시트 이름, 또는 네트워크 연결을 확인해주세요.");
    } finally {
        if (isInitialLoad) { // 초기 로드 후에는 버튼 활성화 (쿨다운 시작 안함)
            refreshButton.disabled = false;
        }
    }
}

// 새로고침 버튼 클릭 이벤트 리스너
refreshButton.addEventListener('click', () => refreshSongList(false)); // false는 초기 로드가 아님

// --- 3. 탭 전환 로직 ---
function showTab(tabId) {
    // 모든 탭 버튼에서 'active' 클래스 제거
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    // 모든 탭 콘텐츠에서 'active' 클래스 제거 (숨김)
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // 선택된 탭 버튼에 'active' 클래스 추가
    document.querySelector(`.tab-button[onclick="showTab('${tabId}')"]`).classList.add('active');
    // 선택된 탭 콘텐츠에 'active' 클래스 추가 (보임)
    document.getElementById(tabId).classList.add('active');
}

// 초기 로드 시 K-POP 탭 활성화 (DOM이 로드된 후 실행)
document.addEventListener('DOMContentLoaded', () => {
    showTab('kpop');
});

// --- 4. 카테고리별 노래 목록 표시 로직 ---
function displayCategorizedSongs(categoryName, songs) {
    // categoryName이 'K-POP'일 때 'kpop-list'로 변환하기 위해 하이픈(-) 제거
    const normalizedCategory = categoryName.toLowerCase().replace(/-/g, '');
    const listElementId = `${normalizedCategory}-list`;
    const listContainer = document.getElementById(listElementId);
    if (!listContainer) {
        console.error(`요소를 찾을 수 없습니다: ${listElementId}`);
        return;
    }
    listContainer.innerHTML = ''; // 기존 목록 초기화

    if (songs.length === 0) {
        listContainer.innerHTML = '<p>노래 목록이 없습니다.</p>';
        return;
    }

    songs.forEach(song => {
        const songDiv = document.createElement('div');
        // 가수 이름을 먼저 표시
        songDiv.innerHTML = `<strong>${song.artist}</strong> - ${song.title}`;
        listContainer.appendChild(songDiv);
    });
}

// --- 5. 번호로 찾기 및 섞기 로직 ---
const songNumberInput = document.getElementById('songNumberInput');
const currentSongDisplay = document.getElementById('currentSongDisplay');
const youtubePlayerDiv = document.getElementById('youtubePlayer');

// 전체 노래 목록을 섞고 번호를 할당하는 함수
function shuffleSongNumbers() {
    const allSongs = [];
    // 모든 카테고리의 노래를 하나의 배열로 합치기
    for (const sheetName of SHEET_NAMES) {
        if (categorizedSongs[sheetName]) {
            allSongs.push(...categorizedSongs[sheetName]);
        }
    }

    // 노래 목록을 무작위로 섞기
    for (let i = allSongs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allSongs[i], allSongs[j]] = [allSongs[j], allSongs[i]]; // 배열 요소 교환
    }

    // 섞인 노래에 새로운 번호 할당 (1부터 시작)
    allSongsById = {}; // 기존 매핑 초기화
    allSongs.forEach((song, index) => {
        const songId = index + 1;
        allSongsById[songId] = song; // 번호를 키로 하여 노래 객체 저장
    });

    currentSongDisplay.textContent = '노래 번호가 새로 부여되었습니다.';
    youtubePlayerDiv.innerHTML = ''; // 기존 플레이어 초기화
}

// 번호로 노래를 찾고 재생하는 함수
function findAndPlaySong() {
    const inputNumber = parseInt(songNumberInput.value);

    if (isNaN(inputNumber) || inputNumber <= 0) {
        currentSongDisplay.textContent = '유효한 노래 번호를 입력해주세요.';
        youtubePlayerDiv.innerHTML = '';
        return;
    }

    const song = allSongsById[inputNumber];

    if (song) {
        // 가수 이름을 먼저 표시
        currentSongDisplay.innerHTML = `<strong>${inputNumber}. ${song.artist}</strong> - ${song.title}`;
        if (song.youtubeid) {
            youtubePlayerDiv.innerHTML = `
                <iframe src="https://www.youtube.com/embed/${song.youtubeid}?autoplay=1" 
                        frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
            `;
        } else {
            youtubePlayerDiv.innerHTML = '<p>이 노래는 YouTube ID가 없습니다.</p>';
        }
    } else {
        currentSongDisplay.textContent = '해당 번호의 노래를 찾을 수 없습니다.';
        youtubePlayerDiv.innerHTML = '';
    }
}