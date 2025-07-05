// !!! 여기에 발급받은 API 키를 입력하세요 !!!
const API_KEY = 'AIzaSyDA0sqk1w-v-TOoiTSVpeN-nDu-4tWqJGg';
// !!! 여기에 구글 스프레드시트 ID를 입력하세요 (URL에서 docs.google.com/spreadsheets/d/여기/edit) !!!
const SPREADSHEET_ID = '15Vkcebz289pU-sKzDGm9ETFfvbZiuG1VYTLcHST-CLw';

// 각 시트의 이름을 배열로 정의 (구글 시트 탭 이름과 정확히 일치)
const SHEET_NAMES = ['a', 'b', 'c']; // 시트 이름을 'a', 'b', 'c'로 변경했습니다.

// 불러온 데이터를 저장할 전역 변수
let categorizedSongs = {};
let allSongsById = {};

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
        refreshSongList(true);
    } catch (error) {
        console.error("Google API 클라이언트 초기화 실패:", error);
        alert("API 초기화에 실패했습니다. API 키와 스프레드시트 ID를 확인해주세요.");
        refreshButton.disabled = true;
    }
}

async function loadSongsFromGoogleSheet() {
    const fetchedData = {};
    for (const sheetName of SHEET_NAMES) {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${sheetName}!A:C`,
            });

            const values = response.result.values;
            if (values && values.length > 1) {
                const headers = values[0].map(h => h.toLowerCase());
                const songs = values.slice(1).map(row => {
                    let song = {};
                    headers.forEach((header, index) => {
                        song[header] = row[index];
                    });
                    if (!song.youtubeid) song.youtubeid = '';
                    return song;
                });
                fetchedData[sheetName] = songs;
            } else {
                fetchedData[sheetName] = [];
                console.warn(`시트 '${sheetName}'에 데이터가 없습니다.`);
            }
        } catch (error) {
            console.error(`시트 '${sheetName}'에서 데이터를 불러오는 데 실패했습니다:`, error);
            fetchedData[sheetName] = [];
        }
    }
    return fetchedData;
}

const refreshButton = document.getElementById('refreshButton');
const cooldownTimerSpan = document.getElementById('cooldownTimer');
const COOLDOWN_SECONDS = 60;
let cooldownInterval;

async function refreshSongList(isInitialLoad = false) {
    if (!isInitialLoad) {
        refreshButton.disabled = true;
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
        categorizedSongs = data;

        displayCategorizedSongs('K-POP', categorizedSongs['a'] || []);
        displayCategorizedSongs('POP', categorizedSongs['b'] || []);
        displayCategorizedSongs('J-POP', categorizedSongs['c'] || []);

        shuffleSongNumbers();
    } catch (error) {
        console.error("노래 목록을 불러오는 중 오류 발생:", error);
        alert("노래 목록을 불러오는 데 실패했습니다. API 키, 스프레드시트 ID, 시트 이름, 또는 네트워크 연결을 확인해주세요.");
    } finally {
        if (isInitialLoad) {
            refreshButton.disabled = false;
        }
    }
}

refreshButton.addEventListener('click', () => refreshSongList(false));

function showTab(tabId) {
    document.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    document.querySelector(`.tab-button[onclick="showTab('${tabId}')"]`).classList.add('active');
    document.getElementById(tabId).classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
    showTab('kpop');
});

function displayCategorizedSongs(categoryName, songs) {
    const normalizedCategory = categoryName.toLowerCase().replace(/-/g, '');
    const listElementId = `${normalizedCategory}-list`;
    const listContainer = document.getElementById(listElementId);
    if (!listContainer) {
        console.error(`요소를 찾을 수 없습니다: ${listElementId}`);
        return;
    }
    listContainer.innerHTML = '';

    if (songs.length === 0) {
        listContainer.innerHTML = '<p>노래 목록이 없습니다.</p>';
        return;
    }

    songs.forEach(song => {
        const songDiv = document.createElement('div');
        songDiv.innerHTML = `<strong>${song.artist}</strong> - ${song.title}`;

        // --- 재생 버튼 추가 로직 시작 ---
        if (song.youtubeid && song.youtubeid.trim() !== '') { // youtubeId가 있으면 재생 버튼 추가
            const playButton = document.createElement('button');
            playButton.className = 'play-button';
            playButton.textContent = '재생';
            playButton.onclick = () => playSongFromList(song); // 클릭 시 playSongFromList 호출

            songDiv.appendChild(playButton); // 노래 정보 뒤에 버튼 추가
        }
        // --- 재생 버튼 추가 로직 끝 ---

        listContainer.appendChild(songDiv);
    });
}

const songNumberInput = document.getElementById('songNumberInput');
const currentSongDisplay = document.getElementById('currentSongDisplay');
const youtubePlayerDiv = document.getElementById('youtubePlayer');

function shuffleSongNumbers() {
    const allSongs = [];
    for (const sheetName of SHEET_NAMES) {
        if (categorizedSongs[sheetName]) {
            allSongs.push(...categorizedSongs[sheetName]);
        }
    }

    // title이 비어있지 않은 노래만 필터링
    const filteredSongs = allSongs.filter(song => song.title && song.title.trim() !== '');

    for (let i = filteredSongs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filteredSongs[i], filteredSongs[j]] = [filteredSongs[j], filteredSongs[i]];
    }

    allSongsById = {};
    filteredSongs.forEach((song, index) => {
        const songId = index + 1;
        allSongsById[songId] = song;
    });

    currentSongDisplay.textContent = '노래 번호가 새로 부여되었습니다.';
    youtubePlayerDiv.innerHTML = '';
}

function findAndPlaySong() {
    const inputNumber = parseInt(songNumberInput.value);

    if (isNaN(inputNumber) || inputNumber <= 0) {
        currentSongDisplay.textContent = '유효한 노래 번호를 입력해주세요.';
        youtubePlayerDiv.innerHTML = '';
        return;
    }

    const song = allSongsById[inputNumber];

    if (song) {
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

// --- 새로 추가된 함수: 목록에서 재생 버튼 클릭 시 호출 ---
function playSongFromList(song) {
    // "랜덤 노래방" 탭으로 전환
    showTab('numberInput');

    // "랜덤 노래방" 탭의 노래 정보 및 유튜브 플레이어 업데이트
    const display = document.getElementById('currentSongDisplay');
    const player = document.getElementById('youtubePlayer');

    if (song) {
        display.innerHTML = `<strong>${song.artist}</strong> - ${song.title}`;
        if (song.youtubeid && song.youtubeid.trim() !== '') {
            player.innerHTML = `
                <iframe src="https://www.youtube.com/embed/${song.youtubeid}?autoplay=1"
                        frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
            `;
        } else {
            player.innerHTML = '<p>이 노래는 YouTube ID가 없습니다.</p>';
        }
    } else {
        display.textContent = '노래 정보를 찾을 수 없습니다.';
        player.innerHTML = '';
    }
    // 유튜브 플레이어가 화면에 보이도록 스크롤 (선택 사항)
    // player.scrollIntoView({ behavior: 'smooth', block: 'center' });
}