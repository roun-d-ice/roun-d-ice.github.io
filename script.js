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
            // A열부터 D열까지 (artist, title, youtubeUrl, albumCoverUrl 순서라고 가정)
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${sheetName}!A:E`, // A:E로 범위 확장 (difficulty 포함)
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
                    if (!song.difficulty) song.difficulty = ''; // difficulty 추가
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
const refreshStatusIcon = document.getElementById('refreshStatusIcon'); // 새로 추가된 아이콘 span
const COOLDOWN_SECONDS = 60;
let cooldownInterval;

async function refreshSongList(isInitialLoad = false) {
    if (!isInitialLoad) {
        refreshButton.disabled = true;
        refreshStatusIcon.textContent = '⟳'; // 아이콘을 회전 화살표로 변경
        refreshStatusIcon.classList.remove('spinning-icon'); // 회전 클래스 제거

        let remainingTime = COOLDOWN_SECONDS;
        // 남은 시간 표시 문구는 제거되므로, 버튼 텍스트는 ✔로 유지

        cooldownInterval = setInterval(() => {
            remainingTime--;
            if (remainingTime <= 0) {
                clearInterval(cooldownInterval);
                refreshButton.disabled = false;
                refreshStatusIcon.textContent = '✔'; // 아이콘을 ✔로 복원
                refreshStatusIcon.classList.remove('spinning-icon'); // 회전 클래스 제거
            } else {
                // 남은 시간 표시 문구는 제거되므로, 버튼 텍스트는 ✔로 유지
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

        renderSongList(); // '노래 목록' 탭의 노래를 렌더링
        shuffleSongNumbers(); // '랜덤 노래방' 탭의 노래를 섞고 총 곡수 업데이트
    } catch (error) {
        console.error("노래 목록을 불러오는 중 오류 발생:", error);
        alert("노래 목록을 불러오는 데 실패했습니다. API 키, 스프레드시트 ID, 시트 이름, 또는 네트워크 연결을 확인해주세요.");
    } finally {
        if (isInitialLoad) {
            refreshButton.disabled = false;
            refreshStatusIcon.textContent = '✔'; // 초기 로드 시 아이콘을 ✔로 복원
            refreshStatusIcon.classList.remove('spinning-icon'); // 초기 로드 시 회전 클래스 제거
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
    const difficultyFilter = document.getElementById('difficultyFilter');
    const songNumberInput = document.getElementById('songNumberInput');

    if (searchBar) {
        searchBar.addEventListener('input', renderSongList);
    }
    if (categoryFilter) {
        categoryFilter.addEventListener('change', renderSongList);
    }
    if (difficultyFilter) {
        difficultyFilter.addEventListener('change', renderSongList);
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

function extractYoutubeId(url) {
    if (!url || typeof url !== 'string') return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// 별점 문자열 생성 함수 (채워진 별만 표시)
function getStarRating(rating) {
    const fullStar = '💗'; // 별 이모지를 하트 이모지로 변경
    let stars = '';
    for (let i = 0; i < rating; i++) {
        stars += fullStar;
    }
    return stars;
}


// 노래 목록을 필터링하고 표시하는 함수 (이전 displayCategorizedSongs 역할)
function renderSongList() {
    const searchBar = document.getElementById('searchBar');
    const categoryFilter = document.getElementById('categoryFilter');
    const difficultyFilter = document.getElementById('difficultyFilter');
    const songListContainer = document.getElementById('combined-song-list');

    if (!songListContainer) return;

    const searchTerm = searchBar ? searchBar.value.toLowerCase() : '';
    const selectedCategory = categoryFilter ? categoryFilter.value : '전체';
    const selectedDifficulty = difficultyFilter ? difficultyFilter.value : '전체';

    let filteredSongs = allLoadedSongs.filter(song => {
        const categoryMatch = selectedCategory === '전체' || song.category === selectedCategory;

        const difficultyMatch = selectedDifficulty === '전체' ||
                                (song.difficulty && parseInt(song.difficulty) === parseInt(selectedDifficulty));

        const searchMatch = searchTerm === '' ||
                            (song.title && song.title.toLowerCase().includes(searchTerm)) ||
                            (song.artist && song.artist.toLowerCase().includes(searchTerm));

        return categoryMatch && difficultyMatch && searchMatch;
    });

    filteredSongs = filteredSongs.filter(song => song.title && song.title.trim() !== '');

    songListContainer.innerHTML = '';

    if (filteredSongs.length === 0) {
        songListContainer.innerHTML = '<p>노래 목록이 없습니다.</p>';
        return;
    }

    filteredSongs.forEach(song => {
        const songEntryDiv = document.createElement('div');
        songEntryDiv.className = 'song-entry';

        const albumCoverImg = document.createElement('img');
        albumCoverImg.className = 'album-cover';
        albumCoverImg.src = song.albumcoverurl || 'https://via.placeholder.com/150?text=No+Cover';
        albumCoverImg.alt = `${song.title} 앨범 자켓`;
        songEntryDiv.appendChild(albumCoverImg);

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

        if (song.difficulty && parseInt(song.difficulty) >= 1 && parseInt(song.difficulty) <= 5) {
            const difficultyDiv = document.createElement('div');
            difficultyDiv.className = 'difficulty-rating';
            difficultyDiv.textContent = getStarRating(parseInt(song.difficulty));
            songEntryDiv.appendChild(difficultyDiv);
        }


        const youtubeId = extractYoutubeId(song.youtubeurl);
        if (youtubeId) {
            songEntryDiv.style.cursor = 'pointer';
            songEntryDiv.onclick = () => openYoutubePopup(song.youtubeurl, `${song.artist} - ${song.title}`);
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
        youtubePlayerDiv.innerHTML = '';

        const youtubeId = extractYoutubeId(song.youtubeurl);
        if (youtubeId) {
            const playButton = document.createElement('button');
            playButton.className = 'play-button';
            playButton.textContent = '재생';
            playButton.onclick = () => openYoutubePopup(song.youtubeurl, `${song.artist} - ${song.title}`);
            youtubePlayerDiv.appendChild(playButton);
        } else {
            youtubePlayerDiv.innerHTML = '<p>이 노래는 YouTube ID가 없습니다.</p>';
        }
    } else {
        currentSongDisplay.textContent = '해당 번호의 노래를 찾을 수 없습니다.';
        youtubePlayerDiv.innerHTML = '';
    }
}

function openYoutubePopup(youtubeUrl, songInfo) {
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }

    const youtubeId = extractYoutubeId(youtubeUrl);
    if (!youtubeId) {
        alert('유효한 YouTube URL이 아닙니다.');
        return;
    }

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    const closeButton = document.createElement('button');
    closeButton.className = 'close-button';
    closeButton.innerHTML = '&times;';
    closeButton.onclick = () => {
        modalOverlay.remove();
        document.body.style.overflow = '';
    };

    const youtubeIframe = document.createElement('iframe');
    youtubeIframe.setAttribute('src', `https://www.youtube.com/embed/${youtubeId}?autoplay=1`);
    youtubeIframe.setAttribute('frameborder', '0');
    youtubeIframe.setAttribute('allow', 'autoplay; encrypted-media');
    youtubeIframe.setAttribute('allowfullscreen', 'true');
    youtubeIframe.setAttribute('title', songInfo);

    modalContent.appendChild(closeButton);
    modalContent.appendChild(youtubeIframe);

    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    document.body.style.overflow = 'hidden';
}