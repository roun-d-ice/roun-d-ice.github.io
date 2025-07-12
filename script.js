// !!! 여기에 발급받은 API 키를 입력하세요 !!!
const API_KEY = 'AIzaSyDA0sqk1w-v-TOoiTSVpeN-nDu-4tWqJGg';
// !!! 여기에 구글 스프레드시트 ID를 입력하세요 (URL에서 docs.google.com/spreadsheets/d/여기/edit) !!!
const SPREADSHEET_ID = '15Vkcebz289pU-sKzDGm9ETFfvbZiuG1VYTLcHST-CLw';

// 각 시트의 이름을 배열로 정의 (구글 시트 탭 이름과 정확히 일치)
const SHEET_NAMES = ['a', 'b', 'c']; // 'a', 'b', 'c'가 K-POP, POP, J-POP에 해당한다고 가정

// 불러온 데이터를 저장할 전역 변수
let categorizedSongs = {};
let allLoadedSongs = []; // 모든 노래를 통합하여 저장할 배열
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
            // A열부터 E열까지 (artist, title, youtubeUrl, albumCoverUrl, proficiency 순서라고 가정)
            // 구글 시트의 해당 열 이름을 'proficiency'로 변경해야 합니다.
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${sheetName}!A:E`, // A:E로 범위 확장 (proficiency 포함)
            });

            const values = response.result.values;
            if (values && values.length > 1) {
                const headers = values[0].map(h => h.toLowerCase());
                const songs = values.slice(1).map(row => {
                    let song = {};
                    headers.forEach((header, index) => {
                        song[header] = row[index];
                    });
                    if (!song.youtubeurl) song.youtubeurl = '';
                    if (!song.albumcoverurl) song.albumcoverurl = '';
                    if (!song.proficiency) song.proficiency = ''; // difficulty -> proficiency 변경
                    // 각 노래에 카테고리 정보 추가
                    let category = '';
                    if (sheetName === 'a') category = 'K-POP';
                    else if (sheetName === 'b') category = 'POP';
                    else if (sheetName === 'c') category = 'J-POP';
                    song.category = category;
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
const refreshStatusIcon = document.getElementById('refreshStatusIcon');
const COOLDOWN_SECONDS = 60;
let cooldownInterval;

async function refreshSongList(isInitialLoad = false) {
    if (!isInitialLoad) {
        refreshButton.disabled = true;
        refreshStatusIcon.textContent = '⟳'; // 아이콘을 ⟳로 변경
        // refreshStatusIcon.classList.remove('spinning-icon'); // CSS에서 애니메이션 제거했으므로 이 줄은 필요 없음

        let remainingTime = COOLDOWN_SECONDS;

        cooldownInterval = setInterval(() => {
            remainingTime--;
            if (remainingTime <= 0) {
                clearInterval(cooldownInterval);
                refreshButton.disabled = false;
                refreshStatusIcon.textContent = '✔';
            }
        }, 1000);
    }

    try {
        const data = await loadSongsFromGoogleSheet();
        categorizedSongs = data;

        allLoadedSongs = [];
        SHEET_NAMES.forEach(sheetName => {
            if (categorizedSongs[sheetName]) {
                allLoadedSongs.push(...categorizedSongs[sheetName]);
            }
        });

        renderSongList();
        shuffleSongNumbers();
    } catch (error) {
        console.error("노래 목록을 불러오는 중 오류 발생:", error);
        alert("노래 목록을 불러오는 데 실패했습니다. API 키, 스프레드시트 ID, 시트 이름, 또는 네트워크 연결을 확인해주세요.");
    } finally {
        if (isInitialLoad) {
            refreshButton.disabled = false;
            refreshStatusIcon.textContent = '✔';
        }
    }
}

refreshButton.addEventListener('click', () => refreshSongList(false));

function showTab(tabId) {
    document.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    document.querySelector(`.tab-button[onclick="showTab('${tabId}')"]`).classList.add('active');
    document.getElementById(tabId).classList.add('active');

    if (tabId === 'songList') {
        renderSongList();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    showTab('songList');

    const searchBar = document.getElementById('searchBar');
    const categoryFilter = document.getElementById('categoryFilter');
    const proficiencyFilter = document.getElementById('proficiencyFilter'); // difficultyFilter -> proficiencyFilter 변경
    const songNumberInput = document.getElementById('songNumberInput');

    if (searchBar) {
        searchBar.addEventListener('input', renderSongList);
    }
    if (categoryFilter) {
        categoryFilter.addEventListener('change', renderSongList);
    }
    if (proficiencyFilter) { // difficultyFilter -> proficiencyFilter 변경
        proficiencyFilter.addEventListener('change', renderSongList);
    }

    if (songNumberInput) {
        songNumberInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                findAndPlaySong();
            }
        });
    }
});

// 새 탭에서 URL 열기 함수
function openInNewTab(url) {
    if (url && url.trim() !== '') {
        window.open(url, '_blank');
    } else {
        alert('연결할 URL이 없습니다.');
    }
}

function getStarRating(rating) {
    const fullStar = '💗';
    let stars = '';
    for (let i = 0; i < rating; i++) {
        stars += fullStar;
    }
    return stars;
}

function renderSongList() {
    const searchBar = document.getElementById('searchBar');
    const categoryFilter = document.getElementById('categoryFilter');
    const proficiencyFilter = document.getElementById('proficiencyFilter'); // difficultyFilter -> proficiencyFilter 변경
    const songListContainer = document.getElementById('combined-song-list');

    if (!songListContainer) return;

    const searchTerm = searchBar ? searchBar.value.toLowerCase() : '';
    const selectedCategory = categoryFilter ? categoryFilter.value : '전체';
    const selectedProficiency = proficiencyFilter ? proficiencyFilter.value : '전체'; // selectedDifficulty -> selectedProficiency 변경

    let filteredSongs = allLoadedSongs.filter(song => {
        const categoryMatch = selectedCategory === '전체' || song.category === selectedCategory;

        const proficiencyMatch = selectedProficiency === '전체' || // difficultyMatch -> proficiencyMatch 변경
                                (song.proficiency && parseInt(song.proficiency) === parseInt(selectedProficiency)); // song.difficulty -> song.proficiency 변경

        const searchMatch = searchTerm === '' ||
                            (song.title && song.title.toLowerCase().includes(searchTerm)) ||
                            (song.artist && song.artist.toLowerCase().includes(searchTerm));

        return categoryMatch && proficiencyMatch && searchMatch; // difficultyMatch -> proficiencyMatch 변경
    });

    filteredSongs = filteredSongs.filter(song => song.title && song.title.trim() !== '');

    const categoryOrder = { 'K-POP': 1, 'POP': 2, 'J-POP': 3 };

    filteredSongs.sort((a, b) => {
        const categoryA = categoryOrder[a.category] || 99;
        const categoryB = categoryOrder[b.category] || 99;

        if (categoryA < categoryB) return -1;
        if (categoryA > categoryB) return 1;

        const artistA = (a.artist || '').toLowerCase();
        const artistB = (b.artist || '').toLowerCase();
        if (artistA < artistB) return -1;
        if (artistA > artistB) return 1;

        return 0;
    });

    songListContainer.innerHTML = '';

    if (filteredSongs.length === 0) {
        songListContainer.innerHTML = '<p>노래 목록이 없습니다.</p>';
        return;
    }

    filteredSongs.forEach(song => {
        const songEntryDiv = document.createElement('div');
        songEntryDiv.className = 'song-entry';

        // 앨범 커버를 감싸는 div 생성
        const albumCoverWrapper = document.createElement('div');
        albumCoverWrapper.className = 'album-cover-wrapper';

        const albumCoverImg = document.createElement('img');
        albumCoverImg.className = 'album-cover';
        albumCoverImg.src = song.albumcoverurl || 'https://via.placeholder.com/150?text=No+Cover';
        albumCoverImg.alt = `${song.title} 앨범 자켓`;
        
        albumCoverWrapper.appendChild(albumCoverImg); // 이미지를 래퍼에 추가
        songEntryDiv.appendChild(albumCoverWrapper); // 래퍼를 노래 항목에 추가

        const titleDiv = document.createElement('div');
        titleDiv.className = 'song-title';
        const titleSpan = document.createElement('span');
        titleSpan.className = 'song-title-text';
        titleSpan.textContent = song.title;
        titleDiv.appendChild(titleSpan);
        songEntryDiv.appendChild(titleDiv);

        const artistDiv = document.createElement('div');
        artistDiv.className = 'artist-name';
        const artistSpan = document.createElement('span');
        artistSpan.className = 'artist-name-text';
        artistSpan.textContent = song.artist;
        artistDiv.appendChild(artistSpan);
        songEntryDiv.appendChild(artistDiv);

        if (song.proficiency && parseInt(song.proficiency) >= 1 && parseInt(song.proficiency) <= 5) { // song.difficulty -> song.proficiency 변경
            const proficiencyDiv = document.createElement('div'); // difficultyDiv -> proficiencyDiv 변경
            proficiencyDiv.className = 'proficiency-rating'; // difficulty-rating -> proficiency-rating 변경
            proficiencyDiv.textContent = getStarRating(parseInt(song.proficiency)); // song.difficulty -> song.proficiency 변경
            songEntryDiv.appendChild(proficiencyDiv); // difficultyDiv -> proficiencyDiv 변경
        }

        // 유튜브 URL이 존재하면 클릭 가능하게 하고 새 탭에서 열기
        if (song.youtubeurl && song.youtubeurl.trim() !== '') {
            songEntryDiv.style.cursor = 'pointer';
            songEntryDiv.onclick = () => openInNewTab(song.youtubeurl);
        } else {
            songEntryDiv.style.cursor = 'default';
        }

        songListContainer.appendChild(songEntryDiv);

        setTimeout(() => {
            const titleTextWidth = titleSpan.offsetWidth;
            const artistTextWidth = artistSpan.offsetWidth;

            const titleContainerWidth = titleDiv.clientWidth;
            const artistContainerWidth = artistDiv.clientWidth;

            if (titleTextWidth > titleContainerWidth) {
                titleDiv.classList.add('overflowing-text');
            } else {
                titleDiv.classList.remove('overflowing-text');
            }

            if (artistTextWidth > artistContainerWidth) {
                artistDiv.classList.add('overflowing-text');
            } else {
                artistDiv.classList.remove('overflowing-text');
            }
        }, 0);
    });
}

const songNumberInput = document.getElementById('songNumberInput');
const currentSongDisplay = document.getElementById('currentSongDisplay');
const youtubePlayerDiv = document.getElementById('youtubePlayer');
const totalSongsCountSpan = document.getElementById('totalSongsCount');

function shuffleSongNumbers() {
    const allSongs = [];
    for (const sheetName of SHEET_NAMES) {
        if (categorizedSongs[sheetName]) {
            allSongs.push(...categorizedSongs[sheetName]);
        }
    }

    const filteredSongs = allSongs.filter(song => song.title && song.title.trim() !== '');

    if (totalSongsCountSpan) {
        totalSongsCountSpan.textContent = `(총 ${filteredSongs.length}곡)`;
    }

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
    currentSongDisplay.style.display = 'block'; // 노래 번호 부여 시 박스 보이게
}

function findAndPlaySong() {
    const inputNumber = parseInt(songNumberInput.value);

    // youtubePlayerDiv와 currentSongDisplay의 이전 내용 지우기
    youtubePlayerDiv.innerHTML = '';
    currentSongDisplay.innerHTML = ''; // 이전 메시지 지우기 (노래 번호 표시 박스 내용 삭제)

    // currentSongDisplay를 기본적으로 숨김
    currentSongDisplay.style.display = 'none'; // 추가: 박스 숨기기

    if (isNaN(inputNumber) || inputNumber <= 0) {
        currentSongDisplay.textContent = '유효한 노래 번호를 입력해주세요.';
        currentSongDisplay.style.display = 'block'; // 유효하지 않은 경우 박스 다시 보이게
        return;
    }

    const song = allSongsById[inputNumber];

    if (song) {
        // 노래 카드를 생성하여 youtubePlayerDiv에 추가하는 기존 로직
        const songEntryDiv = document.createElement('div');
        songEntryDiv.className = 'song-entry'; 

        // 앨범 커버를 감싸는 div 생성
        const albumCoverWrapper = document.createElement('div');
        albumCoverWrapper.className = 'album-cover-wrapper';

        const albumCoverImg = document.createElement('img');
        albumCoverImg.className = 'album-cover';
        albumCoverImg.src = song.albumcoverurl || 'https://via.placeholder.com/150?text=No+Cover';
        albumCoverImg.alt = `${song.title} 앨범 자켓`;
        
        albumCoverWrapper.appendChild(albumCoverImg); // 이미지를 래퍼에 추가
        songEntryDiv.appendChild(albumCoverWrapper); // 래퍼를 노래 항목에 추가

        const titleDiv = document.createElement('div');
        titleDiv.className = 'song-title';
        const titleSpan = document.createElement('span');
        titleSpan.className = 'song-title-text';
        titleSpan.textContent = song.title;
        titleDiv.appendChild(titleSpan);
        songEntryDiv.appendChild(titleDiv);

        const artistDiv = document.createElement('div');
        artistDiv.className = 'artist-name';
        const artistSpan = document.createElement('span');
        artistSpan.className = 'artist-name-text';
        artistSpan.textContent = song.artist;
        artistDiv.appendChild(artistSpan);
        songEntryDiv.appendChild(artistDiv);

        if (song.proficiency && parseInt(song.proficiency) >= 1 && parseInt(song.proficiency) <= 5) { // song.difficulty -> song.proficiency 변경
            const proficiencyDiv = document.createElement('div'); // difficultyDiv -> proficiencyDiv 변경
            proficiencyDiv.className = 'proficiency-rating'; // difficulty-rating -> proficiency-rating 변경
            proficiencyDiv.textContent = getStarRating(parseInt(song.proficiency)); // song.difficulty -> song.proficiency 변경
            songEntryDiv.appendChild(proficiencyDiv); // difficultyDiv -> proficiencyDiv 변경
        }

        // 유튜브 URL이 존재하면 클릭 가능하게 하고 새 탭에서 열기
        if (song.youtubeurl && song.youtubeurl.trim() !== '') {
            songEntryDiv.style.cursor = 'pointer';
            songEntryDiv.onclick = () => openInNewTab(song.youtubeurl);
        } else {
            songEntryDiv.style.cursor = 'default';
        }

        youtubePlayerDiv.appendChild(songEntryDiv); // youtubePlayerDiv에 노래 카드 추가

        setTimeout(() => {
            const titleTextWidth = titleSpan.offsetWidth;
            const artistTextWidth = artistSpan.offsetWidth;

            const titleContainerWidth = titleDiv.clientWidth;
            const artistContainerWidth = artistDiv.clientWidth;

            if (titleTextWidth > titleContainerWidth) {
                titleDiv.classList.add('overflowing-text');
            } else {
                titleDiv.classList.remove('overflowing-text');
            }

            if (artistTextWidth > artistContainerWidth) {
                artistDiv.classList.add('overflowing-text');
            } else {
                artistDiv.classList.remove('overflowing-text');
            }
        }, 0);

    } else {
        youtubePlayerDiv.innerHTML = '<p>해당 번호의 노래를 찾을 수 없습니다.</p>';
        currentSongDisplay.style.display = 'block'; // 노래를 찾지 못한 경우 박스 다시 보이게
    }
}